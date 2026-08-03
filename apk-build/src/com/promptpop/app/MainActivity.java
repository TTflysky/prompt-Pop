package com.promptpop.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
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
    private static final int CAMERA_CAPTURE_REQUEST = 1002;
    private static final String UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/TTflysky/prompt-Pop/main/update.json";
    private static final String UPDATE_ASSET_ROOT = "https://raw.githubusercontent.com/TTflysky/prompt-Pop/main/";
    private static final String[] UPDATE_FILES = {"index.html", "styles.css", "app.js"};
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraImageUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !isLocalAppUrl(url);
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (!failingUrl.startsWith("file:///android_asset/") && failingUrl.startsWith(Uri.fromFile(getUpdateRoot()).toString())) {
                    getSharedPreferences("promptpop", MODE_PRIVATE).edit().putBoolean("use-hot-update", false).apply();
                    webView.loadUrl("file:///android_asset/index.html");
                }
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                try {
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    String mimeType = "image/*";
                    String[] accepts = params.getAcceptTypes();
                    for (String accept : accepts) if (accept != null && accept.startsWith("text/")) { mimeType = "text/plain"; break; }
                    if (params.isCaptureEnabled() && mimeType.startsWith("image/")) {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.Images.Media.DISPLAY_NAME, "prompt-pop-camera-" + System.currentTimeMillis() + ".jpg");
                        values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) values.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Prompt Pop");
                        cameraImageUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                        if (cameraImageUri == null) throw new IllegalStateException("Unable to prepare camera image");
                        Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri);
                        camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivityForResult(camera, CAMERA_CAPTURE_REQUEST);
                        return true;
                    }
                    intent.setType(mimeType);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false);
                    if (mimeType.startsWith("image/")) { intent.setAction(Intent.ACTION_PICK); intent.setData(MediaStore.Images.Media.EXTERNAL_CONTENT_URI); }
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
            GenerationService.begin(MainActivity.this);
            new Thread(() -> executeRequest(requestId, payload)).start();
        }

        @JavascriptInterface
        public void checkForUpdate(final String requestId) {
            new Thread(() -> MainActivity.this.checkForUpdate(requestId)).start();
        }

        @JavascriptInterface
        public void applyUpdate(final String requestId) {
            new Thread(() -> MainActivity.this.applyUpdate(requestId)).start();
        }

        @JavascriptInterface
        public void reloadUpdatedApp() {
            runOnUiThread(() -> loadAppContent());
        }

        @JavascriptInterface
        public void saveImageToGallery(final String requestId, final String source, final String filename) {
            new Thread(() -> MainActivity.this.saveImageToGallery(requestId, source, filename)).start();
        }

        @JavascriptInterface
        public void saveTextFile(final String requestId, final String text, final String filename) {
            new Thread(() -> MainActivity.this.saveTextFile(requestId, text, filename)).start();
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
        boolean useHotUpdate = getSharedPreferences("promptpop", MODE_PRIVATE).getBoolean("use-hot-update", false);
        webView.loadUrl(useHotUpdate && updatedIndex.isFile() ? Uri.fromFile(updatedIndex).toString() : "file:///android_asset/index.html");
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
            getSharedPreferences("promptpop", MODE_PRIVATE).edit().putBoolean("use-hot-update", true).apply();
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
            GenerationService.end();
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

    private void saveImageToGallery(String requestId, String source, String filename) {
        Uri savedUri = null;
        try {
            ImageData image = loadImageData(source);
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
            values.put(MediaStore.Images.Media.MIME_TYPE, image.mimeType);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Prompt Pop");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
            }
            ContentResolver resolver = getContentResolver();
            Uri collection = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                : MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
            savedUri = resolver.insert(collection, values);
            if (savedUri == null) throw new IllegalStateException("Unable to create gallery image");
            OutputStream output = resolver.openOutputStream(savedUri);
            if (output == null) throw new IllegalStateException("Unable to write gallery image");
            output.write(image.bytes);
            output.close();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues ready = new ContentValues();
                ready.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(savedUri, ready, null, null);
            }
            sendSaveImageResult(requestId, savedUri.toString(), "");
        } catch (Exception error) {
            if (savedUri != null) getContentResolver().delete(savedUri, null, null);
            sendSaveImageResult(requestId, "", error.getMessage() == null ? "Unable to save image" : error.getMessage());
        }
    }

    private void saveTextFile(String requestId, String text, String filename) {
        Uri savedUri = null;
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, "text/plain");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Downloads.RELATIVE_PATH, "Download/Prompt Pop");
                values.put(MediaStore.Downloads.IS_PENDING, 1);
            }
            ContentResolver resolver = getContentResolver();
            Uri collection = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY) : MediaStore.Downloads.EXTERNAL_CONTENT_URI;
            savedUri = resolver.insert(collection, values);
            if (savedUri == null) throw new IllegalStateException("Unable to create config file");
            OutputStream output = resolver.openOutputStream(savedUri);
            if (output == null) throw new IllegalStateException("Unable to write config file");
            output.write(text.getBytes(StandardCharsets.UTF_8));
            output.close();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) { ContentValues ready = new ContentValues(); ready.put(MediaStore.Downloads.IS_PENDING, 0); resolver.update(savedUri, ready, null, null); }
            sendSaveTextResult(requestId, savedUri.toString(), "");
        } catch (Exception error) {
            if (savedUri != null) getContentResolver().delete(savedUri, null, null);
            sendSaveTextResult(requestId, "", error.getMessage() == null ? "Unable to export config" : error.getMessage());
        }
    }

    private ImageData loadImageData(String source) throws Exception {
        if (source.startsWith("data:image/")) {
            int separator = source.indexOf(',');
            if (separator < 0) throw new IllegalArgumentException("Invalid image data");
            String header = source.substring(0, separator);
            String mimeType = header.substring(5, header.indexOf(';'));
            return new ImageData(Base64.decode(source.substring(separator + 1), Base64.DEFAULT), mimeType);
        }
        URL url = new URL(source);
        if (!"https".equalsIgnoreCase(url.getProtocol())) throw new IllegalArgumentException("Only HTTPS image URLs can be saved");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        try {
            connection.setConnectTimeout(30000);
            connection.setReadTimeout(60000);
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IllegalStateException("Image server returned HTTP " + status);
            String contentType = connection.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) contentType = "image/png";
            return new ImageData(readBytes(connection.getInputStream()), contentType.split(";")[0]);
        } finally {
            connection.disconnect();
        }
    }

    private byte[] readBytes(InputStream input) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        input.close();
        return output.toByteArray();
    }

    private void sendSaveImageResult(String requestId, String uri, String error) {
        String script = "window.__nativeSaveImageResponse(" + JSONObject.quote(requestId) + "," + JSONObject.quote(uri) + "," + JSONObject.quote(error) + ");";
        runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    private void sendSaveTextResult(String requestId, String uri, String error) {
        String script = "window.__nativeSaveTextResponse(" + JSONObject.quote(requestId) + "," + JSONObject.quote(uri) + "," + JSONObject.quote(error) + ");";
        runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    private static class ImageData {
        final byte[] bytes;
        final String mimeType;

        ImageData(byte[] bytes, String mimeType) {
            this.bytes = bytes;
            this.mimeType = mimeType;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == CAMERA_CAPTURE_REQUEST) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(resultCode == RESULT_OK && cameraImageUri != null ? new Uri[]{cameraImageUri} : null);
                filePathCallback = null;
            }
            cameraImageUri = null;
            return;
        }
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
