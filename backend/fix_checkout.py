
import sys

file_path = r'c:\laragon\www\petposture\backend\app\Http\Controllers\Api\CheckoutController.php'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_code = """                // 4. Update the Address (In Lunar, addresses are held in OrderAddress)
                $order->shippingAddress()->create([
                    'first_name' => Str::before($request->shipping['address'] ?? 'Customer', ' '),
                    'last_name' => Str::after($request->shipping['address'] ?? 'Customer', ' '),
                    'line_one' => $request->shipping['address'],
                    'contact_email' => $request->shipping['email'],
                    'type' => 'shipping',
                    'country_id' => \\Lunar\\Models\\Country::where('iso2', 'VN')->first()?->id ?? 1,
                ]);"""

new_code = """                // 4. Update the Address (In Lunar, addresses are held in OrderAddress)
                $addressData = [
                    'first_name' => Str::before($request->shipping['address'] ?? 'Customer', ' '),
                    'last_name' => Str::after($request->shipping['address'] ?? 'Customer', ' '),
                    'line_one' => $request->shipping['address'],
                    'contact_email' => $request->shipping['email'],
                    'country_id' => \\Lunar\\Models\\Country::where('iso2', 'VN')->first()?->id ?? 1,
                ];

                $order->shippingAddress()->create(array_merge($addressData, ['type' => 'shipping']));
                $order->billingAddress()->create(array_merge($addressData, ['type' => 'billing']));"""

# Normalize line endings to avoid issues
content_normalized = content.replace('\r\n', '\n')
old_code_normalized = old_code.replace('\r\n', '\n')
new_code_normalized = new_code.replace('\r\n', '\n')

# Use a more flexible search for existing code to ignore slight whitespace variations
# Actually, let's just use the exact content from view_file if possible
# But \r\n/ \n is the most common culprit

if old_code_normalized in content_normalized:
    new_content = content_normalized.replace(old_code_normalized, new_code_normalized)
    # Restore Windows line endings if they were there
    if '\r\n' in content:
        new_content = new_content.replace('\n', '\r\n')
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Success: Code replaced.")
else:
    print("Error: Could not find old_code in content.")
    # Search for a smaller part to see what went wrong
    if "shippingAddress()->create" in content:
        print("Found shippingAddress()->create, but the whole block didn't match.")
    else:
        print("Could not find shippingAddress()->create.")
