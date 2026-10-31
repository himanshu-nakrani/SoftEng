export const THEME_KEY = "syslab-theme";

export const THEME_BOOT = `(function(){function apply(t){document.documentElement.setAttribute("data-theme",t);try{localStorage.setItem("${THEME_KEY}",t)}catch(e){}}try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme:light)").matches?"light":"dark";apply(t)}catch(e){}document.addEventListener("click",function(ev){var b=ev.target.closest&&ev.target.closest("[data-theme-toggle]");if(!b)return;apply(document.documentElement.getAttribute("data-theme")==="light"?"dark":"light")})})();`;
