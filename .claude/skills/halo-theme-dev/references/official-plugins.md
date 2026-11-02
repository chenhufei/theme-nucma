# Official Plugin Integration

Halo's official plugins can extend the frontend UI. Themes should adapt to these plugins rather than re-implementing the same functionality.

## Checking Plugin Availability

Use `pluginFinder.available(pluginName)` to conditionally render plugin-dependent UI:

```html
<button
  th:if="${pluginFinder.available('PluginSearchWidget')}"
  onclick="javascript:SearchWidget.open()"
>
  Search
</button>
```

Always guard plugin-dependent elements with `th:if="${pluginFinder.available('...')}"`.

## Search Widget (PluginSearchWidget)

The official search plugin provides a ready-made search UI:

```html
<button
  th:if="${pluginFinder.available('PluginSearchWidget')}"
  onclick="javascript:SearchWidget.open()"
>
  Search
</button>
```

## Dark Mode Adaptation

Official plugins support a shared color scheme system. Themes that implement dark mode should apply the appropriate class or `data-color-scheme` attribute:

### Method 1: CSS class on `<html>` or `<body>`

| Class                           | Effect                               |
| ------------------------------- | ------------------------------------ |
| `color-scheme-auto`             | Follows system dark/light preference |
| `color-scheme-dark` or `dark`   | Force dark mode                      |
| `color-scheme-light` or `light` | Force light mode                     |

### Method 2: `data-color-scheme` attribute

| Value   | Effect                    |
| ------- | ------------------------- |
| `auto`  | Follows system preference |
| `dark`  | Force dark mode           |
| `light` | Force light mode          |

```html
<html data-color-scheme="auto"></html>
```

Dark mode switching is typically handled by frontend JavaScript (toggling the class/attribute at runtime).
