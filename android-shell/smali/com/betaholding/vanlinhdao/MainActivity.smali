# Vạn Linh Đảo — © 2026 Beta Holding
# Màn hình duy nhất: WebView toàn màn hình chạy bản game trong assets/index.html
.class public Lcom/betaholding/vanlinhdao/MainActivity;
.super Landroid/app/Activity;
.source "MainActivity.java"

.field private web:Landroid/webkit/WebView;

.method public constructor <init>()V
    .registers 1
    invoke-direct {p0}, Landroid/app/Activity;-><init>()V
    return-void
.end method

.method protected onCreate(Landroid/os/Bundle;)V
    .registers 6
    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    # toàn màn hình (0x400) + giữ màn hình sáng (0x80)
    invoke-virtual {p0}, Lcom/betaholding/vanlinhdao/MainActivity;->getWindow()Landroid/view/Window;
    move-result-object v0
    const/16 v1, 0x480
    invoke-virtual {v0, v1, v1}, Landroid/view/Window;->setFlags(II)V

    new-instance v0, Landroid/webkit/WebView;
    invoke-direct {v0, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V
    iput-object v0, p0, Lcom/betaholding/vanlinhdao/MainActivity;->web:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
    move-result-object v1
    const/4 v2, 0x1
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowFileAccess(Z)V
    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDatabaseEnabled(Z)V
    const/4 v3, 0x0
    invoke-virtual {v1, v3}, Landroid/webkit/WebSettings;->setMediaPlaybackRequiresUserGesture(Z)V
    invoke-virtual {v1, v3}, Landroid/webkit/WebSettings;->setSupportZoom(Z)V

    # nền sơn mài #2a1512 trong lúc tải
    const v2, -0xd5eaee
    invoke-virtual {v0, v2}, Landroid/webkit/WebView;->setBackgroundColor(I)V

    new-instance v2, Landroid/webkit/WebViewClient;
    invoke-direct {v2}, Landroid/webkit/WebViewClient;-><init>()V
    invoke-virtual {v0, v2}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V

    const-string v2, "file:///android_asset/index.html"
    invoke-virtual {v0, v2}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V

    invoke-virtual {p0, v0}, Lcom/betaholding/vanlinhdao/MainActivity;->setContentView(Landroid/view/View;)V
    return-void
.end method

.method protected onPause()V
    .registers 2
    iget-object v0, p0, Lcom/betaholding/vanlinhdao/MainActivity;->web:Landroid/webkit/WebView;
    if-eqz v0, :done
    invoke-virtual {v0}, Landroid/webkit/WebView;->onPause()V
    :done
    invoke-super {p0}, Landroid/app/Activity;->onPause()V
    return-void
.end method

.method protected onResume()V
    .registers 2
    invoke-super {p0}, Landroid/app/Activity;->onResume()V
    iget-object v0, p0, Lcom/betaholding/vanlinhdao/MainActivity;->web:Landroid/webkit/WebView;
    if-eqz v0, :done
    invoke-virtual {v0}, Landroid/webkit/WebView;->onResume()V
    :done
    return-void
.end method

.method protected onDestroy()V
    .registers 2
    iget-object v0, p0, Lcom/betaholding/vanlinhdao/MainActivity;->web:Landroid/webkit/WebView;
    if-eqz v0, :done
    invoke-virtual {v0}, Landroid/webkit/WebView;->destroy()V
    :done
    invoke-super {p0}, Landroid/app/Activity;->onDestroy()V
    return-void
.end method
