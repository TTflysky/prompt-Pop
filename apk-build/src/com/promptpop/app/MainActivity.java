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
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final String UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/TTflysky/prompt-Pop/main/update.json";
    private static final String UPDATE_ASSET_ROOT = "https://raw.githubusercontent.com/TTflysky/prompt-Pop/main/";
    private static final String[] UPDATE_FILES = {"index.html", "styles.css", "app.js"};
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !isLocalAppUrl(url);
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
        loadAppContent();
    }

    private class ApiBridge {
        @JavascriptInterface
        public void request(final String requestId, final String payload) {
            new Thread(() -> executeRequest(requestId, payload)).start();
        }

        @JavascriptInterface
        public void checkForUpdate(final String requestId) {
            new Thread(() -> checkForUpdate(requestId)).start();
        }

        @JavascriptInterface
        public void applyUpdate(final String requestId) {
            new Thread(() -> applyUpdate(requestId)).start();
        }

        @JavascriptInterface
        public void reloadUpdatedApp() {
            runOnUiThread(() -> loadAppContent());
        }
    }

    private boolean isLocalAppUrl(String url) {
        return url.startsWith("file:///android_asset/") || url.startsWith(Uri.fromFile(getUpdateRoot()).toString());
    }

    private File getUpdateRoot() {
        return new File(getFilesDir(), "promptpop-update");
    }

    private File getUpdatedIndex() {
        return new File(new File(getUpdateRoot(), "current"), "index.html");
    }

    private void loadAppContent() {
        File updatedIndex = getUpdatedIndex();
        webView.loadUrl(updatedIndex.isFile() ? Uri.fromFile(updatedIndex).toString() : "file:///android_asset/index.html");
    }

    private boolean isAllowedApiUrl(URL url) {
        if (!"https".equalsIgnoreCase(url.getProtocol()) || url.getHost().isEmpty()) return false;
        String path = url.getPath();
        return path.endsWith("/models") || path.endsWith("/chat/completions") || path.endsWith("/images/generations") || path.endsWith("/images/edits");
    }

    private boolean isAllowedUpdateUrl(URL url) {
        if (!"https".equalsIgnoreCase(url.getProtocol()) || !"raw.githubusercontent.com".equalsIgnoreCase(url.getHost())) return false;
        String path = url.getPath();
        if ("/TTflysky/prompt-Pop/main/update.json".equals(path)) return true;
        for (String file : UPDATE_FILES) if (("/TTflysky/prompt-Pop/main/" + file).equals(path)) return true;
        return false;
    }

    private JSONObject fetchUpdateManifest() throws Exception {
        URL url = new URL(UPDATE_MANIFEST_URL);
        if (!isAllowedUpdateUrl(url)) throw new IllegalArgumentException("Unsupported update source");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        try {
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(30000);
            connection.setRequestProperty("Cache-Control", "no-cache");
            int status = connection.getResponseCode();
            if (status != 200) throw new IllegalStateException("Update server returned HTTP " + status);
            return new JSONObject(readStream(connection.getInputStream()));
        } finally {
            connection.disconnect();
        }
    }

    private void checkForUpdate(String requestId) {
        try {
            JSONObject manifest = fetchUpdateManifest();
            if (manifest.optString("version").isEmpty()) throw new IllegalStateException("Update manifest is missing a version");
            sendUpdateResult(requestId, 200, manifest.toString(), "");
        } catch (Exception error) {
            sendUpdateResult(requestId, 0, "", error.getMessage() == null ? "Update check failed" : error.getMessage());
        }
    }

    private void applyUpdate(String requestId) {
        try {
            JSONObject manifest = fetchUpdateManifest();
            if (manifest.optString("version").isEmpty()) throw new IllegalStateException("Update manifest is missing a version");
            File root = getUpdateRoot();
            File staging = new File(root, "staging");
            File current = new File(root, "current");
            File backup = new File(root, "backup");
            deleteTree(staging);
            if (!staging.mkdirs()) throw new IllegalStateException("Unable to prepare update storage");
            for (String file : UPDATE_FILES) downloadUpdateFile(file, new File(staging, file));
            deleteTree(backup);
            if (current.exists() && !current.renameTo(backup)) throw new IllegalStateException("Unable to preserve current update");
            if (!staging.renameTo(current)) {
                if (backup.exists()) backup.renameTo(current);
                throw new IllegalStateException("Unable to activate update");
            }
            deleteTree(backup);
            sendUpdateResult(requestId, 200, manifest.toString(), "");
        } catch (Exception error) {
            sendUpdateResult(requestId, 0, "", error.getMessage() == null ? "Update download failed" : error.getMessage());
        }
    }

    private void downloadUpdateFile(String name, File destination) throws Exception {
        URL url = new URL(UPDATE_ASSET_ROOT + name);
        if (!isAllowedUpdateUrl(url)) throw new IllegalArgumentException("Unsupported update file");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        try {
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(60000);
            int status = connection.getResponseCode();
            if (status != 200) throw new IllegalStateException("Unable to download " + name + " (HTTP " + status + ")");
            InputStream input = connection.getInputStream();
            OutputStream output = new FileOutputStream(destination);
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            input.close();
            output.close();
        } finally {
            connection.disconnect();
        }
    }

    private void deleteTree(File file) {
        if (!file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File child : children) deleteTree(child);
        }
        file.delete();
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

    private void sendUpdateResult(String requestId, int status, String body, String error) {
        String script = "window.__nativeUpdateResponse(" + JSONObject.quote(requestId) + "," + status + "," + JSONObject.quote(body) + "," + JSONObject.quote(error) + ");";
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
