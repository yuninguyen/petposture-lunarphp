@php
    $address = $address ?? null;
    $countryName = $address?->country?->name ?? 'United States';
@endphp
@if($address)
{{ $address->first_name }} {{ $address->last_name }}<br>
{{ $address->line_one }}<br>
@if(!empty($address->line_two))
{{ $address->line_two }}<br>
@endif
{{ $address->city }} {{ $address->state }} {{ $address->postcode }}<br>
{{ $countryName }}
@if(!empty($address->contact_phone))
<br>{{ $address->contact_phone }}
@endif
@endif
