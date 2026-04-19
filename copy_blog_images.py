import shutil
import os

sources = [
    r'C:\Users\YUNI-SS980\.gemini\antigravity\brain\5ef2c91a-ebf7-4fb6-a019-72c5f2510d06\blog_hero_posture_golden_1776495958993.png',
    r'C:\Users\YUNI-SS980\.gemini\antigravity\brain\5ef2c91a-ebf7-4fb6-a019-72c5f2510d06\blog_ramp_dachshund_1776495972146.png',
    r'C:\Users\YUNI-SS980\.gemini\antigravity\brain\5ef2c91a-ebf7-4fb6-a019-72c5f2510d06\blog_wellness_cat_bed_1776495990566.png'
]

destinations = [
    r'c:\laragon\www\petposture\frontend\public\assets\blog-hero.png',
    r'c:\laragon\www\petposture\frontend\public\assets\blog-post-1.png',
    r'c:\laragon\www\petposture\frontend\public\assets\blog-post-2.png'
]

for src, dest in zip(sources, destinations):
    try:
        if os.path.exists(src):
            shutil.copy2(src, dest)
            print(f'Successfully copied {src} to {dest}')
        else:
            print(f'Source not found: {src}')
    except Exception as e:
        print(f'Error copying {src}: {e}')
