---
description: Create and load your first Aurora plugin and verify the SDK works end-to-end.
---

# Getting started with plugins

Spin up a bare plugin, load it in Aurora, and poke the Plugin SDK to make sure everything is wired.

{% hint style="info" %}
Plugins are folders on disk with a `package.json` and an entry file. The app loads them at runtime and provides `@aurora/plugin-sdk` to your code.
{% endhint %}

## Usage

{% tabs %}
{% tab title="1) Folder" %}
Create a folder anywhere on your machine, e.g. `~/aurora-plugins/hello-plugin`.

Run `npm init` inside.
{% endtab %}

{% tab title="2) package.json" %}
```json
{
  "name": "hello-plugin",
  "version": "0.1.0",
  "description": "Minimal Aurora plugin",
  "author": "Your Name",
  "main": "index.ts",
  "aurora": {
    "displayName": "Hello Plugin",
    "categories": ["other"]
  }
}
```
{% endtab %}

{% tab title="3) index.ts" %}
```typescript
const CATEGORY = "Examples";

module.exports = {
  async onLoad(api) {
    await api.Settings.register([
      {
        id: "hello",
        title: "Hello world",
        category: CATEGORY,
        kind: "boolean",
        default: true
      }
    ]);

    const v = await api.Settings.get("hello");
    await api.Settings.set("hello", !v);
  },

  async onEnable(api) {
  api.Settings.subscribe("hello", () => {});
  }
};
```

The app compiles TS on the fly. No additional setup is needed.
{% endtab %}
{% endtabs %}

## Load it in the app

1. Open Aurora → Preference → Plugins (from the left sidebar).
2. Click Add Plugin and select your plugin folder.
3. Toggle it on. `onLoad` runs at import time; `onEnable` runs when you enable.

## Verify the SDK

* Open Settings and find the "Examples" section. You should see "Hello world" with a toggle.
* Flip it. The value persists to disk and updates subscribers.

{% hint style="warning" %}
Setting IDs are auto-namespaced. Use bare IDs like `hello`; the app stores them as `plugin.<pluginId>.hello`.
{% endhint %}

## Plugin shape

```typescript
type Plugin = {
  onLoad?(api: AuroraPluginAPI): void | Promise<void>;
  onEnable?(api: AuroraPluginAPI): void | Promise<void>;
  onDisable?(api: AuroraPluginAPI): void | Promise<void>;
  onUnload?(api: AuroraPluginAPI): void | Promise<void>;
};
```

`package.json` keys used by the loader:

* `name`, `version`, `description`, `author`
* `main` (optional). If missing, the app tries `index.js`, `index.ts`, `index.tsx`, then `dist/index.*`.
* `aurora.displayName` (optional UI name)
* `aurora.categories` (shown in the Plugins list)
* `aurora.icon` and `aurora.permissions` (optional; unknown permissions get a warning)
