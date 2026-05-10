package com.fatorangecat.service

import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.setPadding
import com.fatorangecat.core.CatArt
import com.fatorangecat.core.TimerLogic
import com.fatorangecat.core.TimerLogic.Phase
import com.fatorangecat.data.appContainer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.min
import kotlin.math.roundToInt

// The Android answer to content.js: a TYPE_APPLICATION_OVERLAY window that
// covers every app on the device, draws the cat, blocks all touches, and
// swallows Back. Home cannot be intercepted at the app layer — but the
// overlay survives a Home press because it's owned by WindowManager, not
// by an Activity.
class CatOverlayService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var renderJob: Job? = null
    private var rootView: View? = null
    private var timerView: TextView? = null
    private var phraseView: TextView? = null
    private var labelView: TextView? = null
    private var catContainer: FrameLayout? = null

    private val windowManager by lazy { getSystemService(WindowManager::class.java) }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        if (!canDrawOverlays(this)) {
            // No permission means no overlay. The activity is responsible for
            // nudging the user — log and self-stop quietly.
            stopSelf()
            return
        }
        attachOverlay()
        observeState()
    }

    override fun onDestroy() {
        scope.cancel()
        detachOverlay()
        super.onDestroy()
    }

    // ---- window setup ----

    private fun attachOverlay() {
        if (rootView != null) return

        val root = buildRootView()
        rootView = root

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            type,
            // FLAG_LAYOUT_NO_LIMITS extends behind status / nav bars.
            // Default focus behavior (focusable) lets us swallow KEYCODE_BACK.
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
        }

        windowManager.addView(root, params)
    }

    private fun detachOverlay() {
        rootView?.let { runCatching { windowManager.removeView(it) } }
        rootView = null
    }

    private fun buildRootView(): View {
        val ctx: Context = this
        val scrim = FrameLayout(ctx).apply {
            setBackgroundColor(Color.parseColor("#cc000000"))
            isClickable = true
            isFocusable = true
            isFocusableInTouchMode = true
            setOnTouchListener { _, ev ->
                // Consume every touch so nothing reaches the app behind us.
                ev.action != MotionEvent.ACTION_OUTSIDE
            }
        }

        // Block back / home-shortcut keys. Home itself can't be blocked from
        // a non-system app — but the overlay survives Home-press because
        // it's a WindowManager-owned window, not an Activity.
        scrim.setOnKeyListener { _, code, _ ->
            code == KeyEvent.KEYCODE_BACK ||
                code == KeyEvent.KEYCODE_APP_SWITCH ||
                code == KeyEvent.KEYCODE_MENU
        }

        val column = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(24))
        }

        // Cat container. Sized in onState() based on weight + stretch.
        val cat = FrameLayout(ctx).apply {
            layoutParams = FrameLayout.LayoutParams(dp(200), dp(200)).apply {
                gravity = Gravity.CENTER_HORIZONTAL
            }
        }
        cat.addView(buildCatWebView())
        catContainer = cat

        val timer = TextView(ctx).apply {
            text = "5:00"
            setTextColor(Color.parseColor("#fff8ef"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 64f)
            gravity = Gravity.CENTER_HORIZONTAL
            typeface = android.graphics.Typeface.MONOSPACE
        }
        timerView = timer

        val phrase = TextView(ctx).apply {
            text = ""
            setTextColor(Color.parseColor("#ffd6a8"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, dp(8), 0, 0)
        }
        phraseView = phrase

        val label = TextView(ctx).apply {
            text = ""
            setTextColor(Color.parseColor("#ef8b2a"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, dp(20), 0, 0)
        }
        labelView = label

        column.addView(cat)
        column.addView(timer)
        column.addView(phrase)
        column.addView(label)
        scrim.addView(
            column,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply { gravity = Gravity.CENTER },
        )

        return scrim
    }

    private fun buildCatWebView(): WebView {
        val webView = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            // JS is enabled so the renderer can update --cat-stretch from a
            // host-side `evaluateJavascript("window.setStretch(...)")` call.
            // The HTML we load is built locally with no external fetches.
            settings.javaScriptEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.blockNetworkLoads = true
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            // Touches on the WebView itself are still consumed by the
            // parent FrameLayout's onTouchListener.
            setOnTouchListener { _, _ -> true }
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
        }
        val html = """
            <html><head><style>
              html,body{margin:0;padding:0;background:transparent;height:100%;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden}
              svg{width:100%;height:100%;display:block;transform-origin:center bottom;transition:transform 250ms ease-out}
              .stretched svg{transform:scaleX(var(--cat-stretch,1.0))}
            </style></head><body><div class="cat">${CatArt.svgMarkup()}</div>
            <script>
              window.setStretch=function(v){document.documentElement.style.setProperty('--cat-stretch',v);document.querySelector('.cat').classList.toggle('stretched',v>1.001);};
            </script>
            </body></html>
        """.trimIndent()
        webView.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
        return webView
    }

    // ---- state observation + render ----

    private fun observeState() {
        scope.launch {
            appContainer.state.flow.collect { state ->
                when (state.phase) {
                    Phase.BREAK -> startRenderLoop()
                    else -> {
                        // Anything other than BREAK and we exit. The
                        // TimerService also stops us explicitly, but this is
                        // belt-and-suspenders.
                        stopSelf()
                    }
                }
            }
        }
    }

    private fun startRenderLoop() {
        renderJob?.cancel()
        renderJob = scope.launch {
            while (true) {
                val now = System.currentTimeMillis()
                val state = appContainer.state.current()
                if (state.phase != Phase.BREAK) break
                renderFrame(now, state)
                delay(1000)
            }
        }
    }

    private fun renderFrame(now: Long, state: TimerLogic.TimerState) {
        val breakSeconds = TimerLogic.BREAK_MINUTES * 60
        val remaining = TimerLogic.remainingSeconds(state, now)
        val hours = TimerLogic.continuousWorkHours(state.workStreakStartedAt, now)
        val weight = TimerLogic.weightStageForHours(hours)
        val stretch = TimerLogic.stretchFactor(remaining, breakSeconds)

        timerView?.text = TimerLogic.formatMMSS(remaining)
        phraseView?.text = CatArt.phraseForSecond(remaining)
        val labelText = "${weight.label} cat • ${"%.1f".format(hours)}h streak"
        labelView?.text = labelText

        // Resize the cat container to match the weight stage. The viewport
        // analogue here is min(width, height) of the screen — same vmin
        // the extension uses.
        val catSize = catContainer
        if (catSize != null) {
            val metrics = resources.displayMetrics
            val vmin = min(metrics.widthPixels, metrics.heightPixels)
            val sidePx = (vmin * weight.sizeFactor).roundToInt()
            val lp = catSize.layoutParams
            if (lp.width != sidePx || lp.height != sidePx) {
                lp.width = sidePx
                lp.height = sidePx
                catSize.layoutParams = lp
            }
        }

        // Push the stretch factor into the WebView via a tiny JS callback.
        val webView = catContainer?.getChildAt(0) as? WebView
        webView?.evaluateJavascript("window.setStretch(${stretch})", null)
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).roundToInt()

    companion object {
        fun canDrawOverlays(context: Context): Boolean =
            Settings.canDrawOverlays(context)
    }
}
