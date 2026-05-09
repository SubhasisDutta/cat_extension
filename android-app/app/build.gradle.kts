plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.fatorangecat"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.fatorangecat"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    sourceSets["main"].kotlin.srcDirs("src/main/kotlin")
    sourceSets["test"].kotlin.srcDirs("src/test/kotlin")

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    // Pure logic (TimerLogic, CatArt) has no Android dependencies and can be
    // unit-tested directly with JUnit. Android-specific layers (overlay
    // service, foreground service, Compose UI) ship in the next PR.
    testImplementation("junit:junit:4.13.2")
}
