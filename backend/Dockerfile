FROM dunglas/frankenphp:1.2-php8.3-alpine

# Install system dependencies & PHP extensions
RUN apk add --no-cache \
    git \
    unzip \
    libpng-dev \
    libzip-dev \
    icu-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    oniguruma-dev \
    libxml2-dev \
    bash \
    supervisor

RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
    pdo_mysql \
    mbstring \
    exif \
    pcntl \
    bcmath \
    gd \
    intl \
    zip \
    opcache

# Get latest Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /app

# Copy application code
COPY . .

# Install dependencies
RUN composer install --no-dev --optimize-autoloader --no-scripts

# Set permissions for Laravel
RUN chown -R www-data:www-data storage bootstrap/cache

# Copy properly formatted Caddyfile
COPY Caddyfile /etc/caddy/Caddyfile

# Copy supervisor config (runs FrankenPHP + the queue worker as sibling processes)
COPY supervisord.conf /etc/supervisord.conf

# Create a startup script to handle migrations and port binding
RUN echo '#!/bin/sh' > /usr/local/bin/docker-entrypoint.sh && \
    echo 'set -e' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'echo "Running migrations..."' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'php artisan migrate --force || echo "Migration failed, but continuing..."' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'php artisan config:cache' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'php artisan route:cache' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'php artisan view:cache' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'php artisan event:cache' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'php artisan storage:link || true' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'echo "Starting FrankenPHP + queue worker on port $PORT..."' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'export SERVER_NAME=":${PORT:-80}"' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'exec supervisord -c /etc/supervisord.conf' >> /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port 80 (standard for HTTP, Railway will remap)
EXPOSE 80

ENTRYPOINT ["docker-entrypoint.sh"]
