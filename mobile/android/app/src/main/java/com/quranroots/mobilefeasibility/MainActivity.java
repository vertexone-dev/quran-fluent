package com.quranroots.mobilefeasibility;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

/**
 * The app is a single-page app with no server-rendered routes, so Capacitor's
 * BridgeActivity has nothing to override here by default -- with no callback
 * registered, Android's standard back-press behavior just finishes the
 * activity from any screen, including screens reached by navigating deeper
 * within the app (not actually Android's "back" convention, where back is
 * expected to step back one screen at a time before ever exiting).
 *
 * src/App.tsx pushes a history entry via history.pushState() on every
 * in-app navigation (and never on a tab switch, which resets the stack
 * instead), so the WebView's own back/forward history exactly mirrors the
 * app's navigation stack. This callback asks the WebView to go back through
 * that history first; only once the WebView has no more history of its own
 * (i.e. the app is already on a tab's root screen) does it fall through to
 * the system default, which exits -- matching standard Android convention.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher()
            .addCallback(
                this,
                new OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        WebView webView = getBridge().getWebView();
                        if (webView != null && webView.canGoBack()) {
                            webView.goBack();
                        } else {
                            setEnabled(false);
                            getOnBackPressedDispatcher().onBackPressed();
                        }
                    }
                }
            );
    }
}
