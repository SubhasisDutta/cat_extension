# Pure-logic classes are reflected on by `Phase.valueOf(...)` in
# StateRepository — keep them whole so R8 doesn't rename `Phase.WORK` etc.
# Also makes stack traces in Crashlytics-style tools far more readable.
-keep class com.fatorangecat.core.** { *; }
-keepclassmembers enum com.fatorangecat.core.** {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Compose ships its own consumer rules. DataStore-Preferences and
# kotlinx-coroutines-android also do. Don't duplicate them here.

# Manifest-declared components (Application, Activity, Service, Receiver)
# are kept automatically by AGP — no rules needed.

# WebView in CatOverlayService loads HTML built locally and calls
# `evaluateJavascript("window.setStretch(...)")`. The hosted JS is also
# local. Keep WebView's interface shape just in case future R8 versions
# get aggressive about removing reflection-accessed methods.
-keepclassmembers class * extends android.webkit.WebView {
    public *;
}

# Strip BuildConfig debug/log lines in release. Saves a few KB and avoids
# leaking developer-facing strings.
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
}
