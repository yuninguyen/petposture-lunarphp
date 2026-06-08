<?php

return [

    // Image optimizer binaries (jpegoptim, pngquant, etc.) aren't installed on
    // this shared hosting account, so any conversion that runs them throws a
    // Process exception ("command failed") and turns into a 500. Disable
    // optimization entirely -- conversions are still generated, just unoptimized.
    'image_optimizers' => [],

];
