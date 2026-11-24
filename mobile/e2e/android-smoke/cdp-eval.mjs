// Evaluates a JS expression in the app's WebView over Chrome DevTools (debug builds only).
// usage: node cdp-eval.mjs '<expression>'   (needs `adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>`)
const expr = process.argv[2];
const list = await (await fetch("http://localhost:9333/json")).json();
const target = list.find((x) => x.type === "page") ?? list[0];
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
const res = await new Promise((resolve) => {
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id === 1) resolve(d);
  };
  ws.send(
    JSON.stringify({
      id: 1,
      method: "Runtime.evaluate",
      params: { expression: expr, returnByValue: true, awaitPromise: true },
    }),
  );
});
console.log(JSON.stringify(res.result?.result?.value ?? null));
ws.close();
