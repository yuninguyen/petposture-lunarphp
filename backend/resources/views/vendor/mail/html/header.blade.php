@props(['url'])
<tr>
<td class="header">
<a href="{{ $url }}" style="display: inline-block;">
<img src="{{ config('app.frontend_url') }}/assets/Logo-PetPosture-1.png" class="logo" alt="{{ trim($slot) }}">
</a>
</td>
</tr>
