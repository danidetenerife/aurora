---
description: Configura la sincronización privada de Aurora con GitHub Gist
---

# Sincronización privada con GitHub Gist

Aurora puede guardar favoritos, listas, ajustes y el perfil de escucha en un Gist privado de tu propia cuenta de GitHub. El contenido no aparece en tu perfil público ni en los resultados de búsqueda.

## 1. Crear un token de GitHub

1. Abre la [configuración de tokens de GitHub](https://github.com/settings/tokens).
2. En **Tokens (classic)**, pulsa **Generate new token (classic)**.
3. Pon una descripción, por ejemplo `Aurora Sync`.
4. Selecciona únicamente el permiso **gist**.
5. Genera el token y cópialo. GitHub solo lo muestra una vez.

{% hint style="warning" %}
Trata el token como una contraseña. No lo publiques, no lo subas al repositorio y no lo envíes a otra persona. Si crees que se ha expuesto, revócalo en GitHub y genera otro.
{% endhint %}

## 2. Configurarlo en Aurora

1. Abre **Ajustes**.
2. Entra en **Sincronización**.
3. Selecciona la pestaña **GitHub Gist**.
4. Pega el token en **Token de GitHub**.
5. Deja vacío **ID del Gist** para que Aurora encuentre automáticamente un Gist privado que contenga `aurora_sync.json`, o escribe el ID si ya tienes uno.
6. Pulsa **Guardar y sincronizar**.

Si no existe todavía un Gist compatible, Aurora lo crea automáticamente como privado con el archivo `aurora_sync.json`. El ID que genere queda guardado para las siguientes sincronizaciones.

## 3. Usar la misma nube en otro dispositivo

Instala Aurora en el segundo dispositivo y repite la configuración con el mismo token. Puedes dejar vacío el ID: Aurora localizará el Gist privado de tu cuenta. Para revocar el acceso, elimina el token desde GitHub y borra el token guardado en **Ajustes > Sincronización**.

La sincronización automática se ejecuta periódicamente y también después de cambios locales en favoritos, listas o ajustes cuando GitHub Gist está seleccionado como proveedor.
