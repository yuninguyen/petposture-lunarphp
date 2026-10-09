# Third-party notices

The local `u2netp` background-removal model is based on U-2-Net by Xuebin Qin et al.
The upstream project is licensed under Apache License 2.0; its license is included
as `LICENSE-U2NET` in this service image. The model file is fetched by `rembg` while
building the image from the rembg model release. See the rembg maintainer's note on
model provenance and licensing at https://github.com/danielgatis/rembg/issues/837.

The `rembg` software is separately licensed under MIT. It does not grant the rights
to the model weights; the U-2-Net license applies to those weights.
