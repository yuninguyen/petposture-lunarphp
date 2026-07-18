@props(['url', 'message' => null])
<tr>
<td class="header">
<a href="{{ $url }}" style="display: inline-block;">
<img src="{{ $message ? $message->embed(public_path('logo.png')) : 'data:image/png;base64,' . base64_encode(file_get_contents(public_path('logo.png'))) }}" class="logo" alt="{{ trim($slot) }}">
</a>
</td>
</tr>
