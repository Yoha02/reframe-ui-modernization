# Space Jam source evidence

These files were collected from the publicly available Space Jam 1996 site on September 23, 2026. They are raw evidence, not a completed importer fixture. Original content and artwork belong to their respective owners; retain the source copyright and label the demo as an unofficial modernization study.

The source-inventory.json file records source URLs, content-bearing pages behind frame wrappers, checksums, and local asset paths. Asset filenames are content-derived; resolve them through this inventory rather than assuming original names. Per-page asset manifests are capture metadata.

Each page now includes an actual browser screenshot and capture-metadata.json with viewport dimensions, source element bounds, text, links, and image-map coordinates. Screenshot pixel dimensions may differ from CSS viewport dimensions: use the recorded scaleX/scaleY when cropping. The homepage background is included. The remaining step is mapping these captured inputs into the application importer manifest. These are viewport captures of the content-bearing documents, not full scroll captures or frame-wrapper composites. Do not substitute generated illustrations for original evidence.

Use these inputs through the same importer, evaluation, design-system generation, and page renderer that process other sites. Do not add domain-specific production logic for Space Jam. Do not execute legacy scripts while parsing the source.
