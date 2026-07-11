/*
 * GHL Titan — loader de formularios embebibles.
 * Uso inline:  <div data-titan-form="SLUG"></div><script src=".../forms/embed.js" async></script>
 * Uso popup:   <script src=".../forms/embed.js" data-titan-form="SLUG" data-titan-popup="1"
 *                data-titan-trigger="load|delay|scroll" data-titan-delay="5" data-titan-scroll="50" async></script>
 * Botón:       <button data-titan-form-open="SLUG">Abrir</button>
 */
(function () {
  var script =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName('script')
      for (var i = s.length - 1; i >= 0; i--) if (/\/forms\/embed\.js/.test(s[i].src)) return s[i]
      return null
    })()
  if (!script) return
  var origin = new URL(script.src, location.href).origin
  var opened = {}

  function iframeFor(slug, height) {
    var f = document.createElement('iframe')
    f.src = origin + '/form/' + encodeURIComponent(slug) + '?embed=1'
    f.style.width = '100%'
    f.style.border = '0'
    f.style.height = (height || 400) + 'px'
    f.setAttribute('scrolling', 'no')
    f.setAttribute('title', 'Formulario')
    f.setAttribute('data-titan-slug', slug)
    return f
  }

  // Auto-alto: el iframe publica su altura por postMessage
  window.addEventListener('message', function (e) {
    var d = e.data
    if (!d || d.type !== 'titan-form-height' || !d.slug) return
    var frames = document.querySelectorAll('iframe[data-titan-slug="' + d.slug + '"]')
    for (var i = 0; i < frames.length; i++) frames[i].style.height = d.height + 'px'
  })

  function openModal(slug) {
    var overlay = document.createElement('div')
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;'
    var box = document.createElement('div')
    box.style.cssText =
      'position:relative;width:100%;max-width:560px;max-height:90vh;overflow:auto;background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.3);'
    var close = document.createElement('button')
    close.textContent = '×'
    close.setAttribute('aria-label', 'Cerrar')
    close.style.cssText =
      'position:absolute;top:6px;right:10px;font-size:26px;line-height:1;border:0;background:transparent;cursor:pointer;color:#334155;z-index:1;'
    box.appendChild(close)
    box.appendChild(iframeFor(slug, 520))
    overlay.appendChild(box)
    function shut() {
      overlay.remove()
    }
    close.onclick = shut
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) shut()
    })
    document.body.appendChild(overlay)
  }

  function openOnce(slug) {
    if (opened[slug]) return
    opened[slug] = true
    openModal(slug)
  }

  // Botones de apertura manual (delegación)
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-titan-form-open]') : null
    if (t) {
      e.preventDefault()
      openModal(t.getAttribute('data-titan-form-open'))
    }
  })

  var popupSlug = script.getAttribute('data-titan-form')
  var isPopup = script.getAttribute('data-titan-popup') === '1'

  function mountInline() {
    var els = document.querySelectorAll('[data-titan-form]:not(script)')
    for (var i = 0; i < els.length; i++) {
      var el = els[i]
      if (el.getAttribute('data-titan-mounted')) continue
      el.setAttribute('data-titan-mounted', '1')
      el.appendChild(iframeFor(el.getAttribute('data-titan-form')))
    }
  }

  function setupPopup(slug) {
    var trigger = script.getAttribute('data-titan-trigger') || 'load'
    if (trigger === 'delay') {
      setTimeout(function () {
        openOnce(slug)
      }, (parseInt(script.getAttribute('data-titan-delay'), 10) || 5) * 1000)
    } else if (trigger === 'scroll') {
      var pct = parseInt(script.getAttribute('data-titan-scroll'), 10) || 50
      var onScroll = function () {
        var doc = document.documentElement
        var scrolled = ((window.scrollY + window.innerHeight) / (doc.scrollHeight || 1)) * 100
        if (scrolled >= pct) {
          window.removeEventListener('scroll', onScroll)
          openOnce(slug)
        }
      }
      window.addEventListener('scroll', onScroll, { passive: true })
    } else {
      openOnce(slug)
    }
  }

  function init() {
    if (isPopup && popupSlug) setupPopup(popupSlug)
    else mountInline()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
  else init()
})()
