package com.promptpop.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/** Keeps in-flight API work alive while the app is backgrounded. */
public class GenerationService extends Service {
    private static final String CHANNEL_ID = "promptpop_generation";
    private static final String COMPLETE_CHANNEL_ID = "promptpop_complete";
    private static final int NOTIFICATION_ID = 1208;
    private static int activeRequests = 0;
    private static GenerationService runningService;
    private PowerManager.WakeLock wakeLock;

    public static synchronized void begin(Context context) {
        activeRequests++;
        if (activeRequests == 1) {
            Intent intent = new Intent(context, GenerationService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent);
            else context.startService(intent);
        }
    }

    public static synchronized void end() {
        if (activeRequests > 0) activeRequests--;
        if (activeRequests == 0 && runningService != null) {
            runningService.stopForeground(STOP_FOREGROUND_REMOVE);
            runningService.stopSelf();
            runningService = null;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        synchronized (GenerationService.class) {
            runningService = this;
        }
        createChannel();
        startForeground(NOTIFICATION_ID, createNotification());
        PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PromptPop:Generation");
            wakeLock.acquire(20 * 60 * 1000L);
        }
        synchronized (GenerationService.class) {
            if (activeRequests == 0) {
                stopForeground(STOP_FOREGROUND_REMOVE);
                stopSelf();
                runningService = null;
            }
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, createNotification());
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        synchronized (GenerationService.class) {
            if (runningService == this) runningService = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Prompt Pop 生成任务",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("图片和提示词正在生成时保持任务运行");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
        NotificationChannel completeChannel = new NotificationChannel(
            COMPLETE_CHANNEL_ID,
            "Prompt Pop 生成完成",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        completeChannel.setDescription("图片生成完成后的保存提醒");
        if (manager != null) manager.createNotificationChannel(completeChannel);
    }

    public static void notifyCompleted(Context context, boolean savedToGallery) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                COMPLETE_CHANNEL_ID,
                "Prompt Pop 生成完成",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("图片生成完成后的保存提醒");
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(context, COMPLETE_CHANNEL_ID)
            : new Notification.Builder(context);
        Notification notification = builder
            .setSmallIcon(android.R.drawable.stat_sys_upload_done)
            .setContentTitle("Prompt Pop 图片生成完成")
            .setContentText(savedToGallery ? "图片已自动保存到系统相册" : "图片已生成，打开 Prompt Pop 查看结果")
            .setAutoCancel(true)
            .build();
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), notification);
    }

    private Notification createNotification() {
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        return builder
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setContentTitle("Prompt Pop 正在生成")
            .setContentText("切换应用后，任务会继续在后台完成")
            .setOngoing(true)
            .build();
    }
}
