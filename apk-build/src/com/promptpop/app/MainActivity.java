package com.promptpop.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !url.startsWith("file:///android_asset/");
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.setType("image/*");
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception error) {
                    filePathCallback = null;
                    return false;
                }
            }
        });
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        webView.addJavascriptInterface(new ApiBridge(), "PromptPopNative");
        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    private class ApiBridge {
        @JavascriptInterface
        public void request(final String requestId, final String payload) {
            new Thread(() -> executeRequest(requestId, payload)).start();
        }
    }

    private boolean isAllowedApiUrl(URL url) {
        if (!"https".equalsIgnoreCase(url.getProtocol()) || url.getHost().isEmpty()) return false;
        String path = url.getPath();
        return path.endsWith("/models") || path.endsWith("/chat/completions") || path.endsWith("/images/generations") || path.endsWith("/images/edits");
    }

    private void executeRequest(String requestId, String payload) {
        HttpURLConnection connection = null;
        try {
            JSONObject request = new JSONObject(payload);
            String method = request.optString("method", "GET");
            if (!"GET".equals(method) && !"POST".equals(method)) throw new IllegalArgumentException("Unsupported request method");
            URL url = new URL(request.getString("url"));
            if (!isAllowedApiUrl(url)) throw new IllegalArgumentException("Unsupported API endpoint");
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod(method);
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(90000);
            connection.setDoInput(true);
            JSONObject headers = request.optJSONObject("headers");
            if (headers != null) {
                String authorization = headers.optString("Authorization");
                String contentType = headers.optString("Content-Type");
                if (!authorization.isEmpty()) connection.setRequestProperty("Authorization", authorization);
                if (!contentType.isEmpty()) connection.setRequestProperty("Content-Type", contentType);
            }
            String bodyType = request.optString("bodyType", "none");
            if ("json".equals(bodyType)) {
                connection.setDoOutput(true);
                if (connection.getRequestProperty("Content-Type") == null) connection.setRequestProperty("Content-Type", "application/json");
                writeBytes(connection, request.optString("body", "").getBytes(StandardCharsets.UTF_8));
            } else if ("multipart".equals(bodyType)) {
                connection.setDoOutput(true);
                String boundary = "PromptPop" + UUID.randomUUID().toString().replace("-", "");
                connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
                OutputStream output = connection.getOutputStream();
                JSONArray fields = request.optJSONArray("fields");
                for (int index = 0; fields != null && index < fields.length(); index++) writeMultipartField(output, boundary, fields.getJSONObject(index));
                output.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
                output.close();
            } else if (!"none".equals(bodyType)) {
                throw new IllegalArgumentException("Unsupported request body");
            }
            int status = connection.getResponseCode();
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            sendResult(requestId, status, readStream(stream), "");
        } catch (Exception error) {
            sendResult(requestId, 0, "", error.getMessage() == null ? "Native request failed" : error.getMessage());
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void writeBytes(HttpURLConnection connection, byte[] bytes) throws Exception {
        OutputStream output = connection.getOutputStream();
        output.write(bytes);
        output.close();
    }

    private void writeMultipartField(OutputStream output, String boundary, JSONObject field) throws Exception {
        output.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        String name = field.getString("name");
        if (field.has("fileData")) {
            String fileName = field.optString("fileName", "upload.png");
            String mimeType = field.optString("mimeType", "image/png");
            output.write(("Content-Disposition: form-data; name=\"" + name + "\"; filename=\"" + fileName + "\"\r\n").getBytes(StandardCharsets.UTF_8));
            output.write(("Content-Type: " + mimeType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            String data = field.getString("fileData");
            int marker = data.indexOf(',');
            output.write(Base64.decode(marker >= 0 ? data.substring(marker + 1) : data, Base64.DEFAULT));
        } else {
            output.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            output.write(field.optString("value", "").getBytes(StandardCharsets.UTF_8));
        }
        output.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private String readStream(InputStream input) throws Exception {
        if (input == null) return "";
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        input.close();
        return output.toString("UTF-8");
    }

    private void sendResult(String requestId, int status, String body, String error) {
        String script = "window.__nativeApiResponse(" + JSONObject.quote(requestId) + "," + status + "," + JSONObject.quote(body) + "," + JSONObject.quote(error) + ");";
        runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                filePathCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }
}
