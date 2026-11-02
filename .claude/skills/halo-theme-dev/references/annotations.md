# Model Metadata (Annotations)

Themes can extend built-in Halo models with custom fields via `AnnotationSetting` resources.

## Defining a Metadata Form (AnnotationSetting)

Create a file (any name) in the theme root, e.g. `annotation-setting.yaml`:

```yaml
apiVersion: v1alpha1
kind: AnnotationSetting
metadata:
  name: theme-foo-menuitem-abc123
spec:
  targetRef:
    group: ""
    kind: MenuItem
  formSchema:
    - $formkit: text
      name: icon
      label: Menu icon class
      value: ""
```

Multiple models can be declared in the same file separated by `---`.

### Supported Models

| Model         | `group`            | `kind`       |
| ------------- | ------------------ | ------------ |
| Post          | `content.halo.run` | `Post`       |
| Single page   | `content.halo.run` | `SinglePage` |
| Post category | `content.halo.run` | `Category`   |
| Post tag      | `content.halo.run` | `Tag`        |
| Menu item     | `""`               | `MenuItem`   |
| User          | `""`               | `User`       |

### Notes

- All values in `metadata.annotations` are **strings**.
- Do not use components with non-string output such as `number`, `group`, or `repeater`.
- For `checkbox`, explicitly set `on-value` / `off-value` to string values.

## Reading Metadata in Templates

### `#annotations.get(object, key)`

```html
<li th:each="item : ${menu.menuItems}">
  <i th:class="${#annotations.get(item, 'icon')}"></i>
  <a th:href="${item.status.href}" th:text="${item.status.displayName}"></a>
</li>
```

### `#annotations.getOrDefault(object, key, defaultValue)`

```html
<i th:class="${#annotations.getOrDefault(menuItem, 'icon', 'fa fa-link')}"></i>
```

### `#annotations.contains(object, key)`

```html
<i th:if="${#annotations.contains(menuItem, 'icon')}" th:class="${#annotations.get(menuItem, 'icon')}"></i>
```

## Online Docs

- Using metadata in templates: https://raw.githubusercontent.com/halo-dev/docs/refs/heads/main/docs/developer-guide/theme/annotations.md
- Defining annotation forms: https://raw.githubusercontent.com/halo-dev/docs/refs/heads/main/docs/developer-guide/annotations-form.md
