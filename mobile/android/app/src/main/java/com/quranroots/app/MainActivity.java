package com.quranroots.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
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
        // Diagnostic fix (Sprint 4): Capacitor's bundled SystemBars plugin
        // (com.getcapacitor.plugin.SystemBars, see node_modules) calls
        // WindowInsetsControllerCompat.setAppearanceLightStatusBars/
        // setAppearanceLightNavigationBars on every setStyle() call, but
        // never itself calls WindowCompat.setDecorFitsSystemWindows(false)
        // -- Capacitor's own docs note this is expected to be set up by the
        // app (and say Capacitor 9 will do it automatically). Without it,
        // this app's appearance updates only visually took effect on the
        // very first call (made during SystemBars' own plugin load(), amid
        // initial window setup) -- confirmed via logcat that every later
        // call (a runtime theme switch) dispatches correctly and resolves
        // without error, but silently fails to repaint, while a rotation's
        // own relayout immediately repaints whatever style was last
        // requested. Declaring edge-to-edge explicitly, before super.onCreate
        // per this API's own documented usage, is the fix.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

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
