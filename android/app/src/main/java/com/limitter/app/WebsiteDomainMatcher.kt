package com.limitter.app

object WebsiteDomainMatcher {

    val BROWSER_PACKAGES = setOf(
        "com.android.chrome",
        "com.chrome.beta",
        "com.chrome.dev",
        "com.chrome.canary",
        "org.mozilla.firefox",
        "org.mozilla.firefox_beta",
        "com.opera.browser",
        "com.opera.mini.native",
        "com.brave.browser",
        "com.microsoft.emmx",
        "com.samsung.android.app.sbrowser",
        "com.sec.android.app.sbrowser",
        "com.duckduckgo.mobile.android",
        "com.vivaldi.browser",
    )

    fun isBrowser(packageName: String): Boolean {
        return BROWSER_PACKAGES.contains(packageName)
    }

    fun extractDomain(url: String): String? {
        var cleaned = url.trim().lowercase()
        if (cleaned.isEmpty()) return null

        // Strip protocol
        val protocolEnd = cleaned.indexOf("://")
        if (protocolEnd >= 0) {
            cleaned = cleaned.substring(protocolEnd + 3)
        }

        // Strip www.
        if (cleaned.startsWith("www.")) {
            cleaned = cleaned.substring(4)
        }

        // Strip path
        val slashIndex = cleaned.indexOf('/')
        if (slashIndex >= 0) {
            cleaned = cleaned.substring(0, slashIndex)
        }

        // Strip port
        val colonIndex = cleaned.indexOf(':')
        if (colonIndex >= 0) {
            cleaned = cleaned.substring(0, colonIndex)
        }

        return if (cleaned.isNotEmpty() && cleaned.contains('.')) cleaned else null
    }

    fun matchesDomain(currentUrl: String, targetDomain: String): Boolean {
        val current = extractDomain(currentUrl) ?: return false
        val target = extractDomain(targetDomain) ?: return false
        return current == target || current.endsWith(".$target")
    }
}
