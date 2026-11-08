/** image-size: bildedimensjoner fra filheaderen (PO-71) og `width`/`height` for `<img>`. Blad-feature. */
export { fitImageSize } from './fit-image-size';
export type { ImageAttributes, RequestedImageSize } from './fit-image-size';
export { canReadImageSize, imageSizeFromBytes, MAX_IMAGE_DIMENSION, readImageSizeFromFile } from './read-image-size';
export type { ImageSize } from './read-image-size';
