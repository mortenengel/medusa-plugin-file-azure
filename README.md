# Medusa file plugin for Azure Storage

Store uploaded files on Azure Storage

## Features

- Store product images
- Enable import and export via csv

---

## Prerequisites

- [Medusa backend](https://docs.medusajs.com/development/backend/install)

---

## How to Install

1\. Run the following command in the directory of the Medusa backend:

```bash
npm install medusa-plugin-file-azure
```

2 \. In `medusa-config.js` add the following at the end of the `plugins` array:

```js
const plugins = [
  // ...
  {
    resolve: `medusa-plugin-file-azure`,
    options: {
      connectionString: "AZURE CONNECTION STRING",
      protectedContainer: "private",
      publicContainer: "public",
      //if you want to customize expiry or access permissions on the sas link for private downloads, add an optionsbuilder of the type
      //() => BlobGenerateSasUrlOptions"
      //default is 30 days, read only
      //sasOptionsBuilder: () => BlobGenerateSasUrlOptions { //implement }
    }
  },
]
```

---

## Test the Plugin

1\. Run the following command in the directory of the Medusa backend to run the backend:

```bash
npm run start
```

2\. Upload an image for a product using the admin dashboard or upload a file for product import