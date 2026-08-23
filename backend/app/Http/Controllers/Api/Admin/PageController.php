<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Page;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PageController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Page::query();

        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where('title', 'like', "%{$search}%")
                  ->orWhere('slug', 'like', "%{$search}%");
        }

        $perPage = $request->input('per_page', 10);
        
        $pages = $query->latest('updated_at')->paginate($perPage);

        return response()->json($pages);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => 'required|string|max:255|unique:pages,slug',
            'content' => 'required|string',
            'meta_title' => 'nullable|string|max:255',
            'meta_description' => 'nullable|string',
            'is_active' => 'boolean',
            'status' => 'required|in:draft,invisible,published',
        ]);

        $validated['is_active'] = $validated['is_active'] ?? true;
        
        $page = Page::create($validated);

        return response()->json($page);
    }

    /**
     * Display the specified resource.
     */
    public function show(Page $page)
    {
        return response()->json($page);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Page $page)
    {
        $rules = [
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'meta_title' => 'nullable|string|max:255',
            'meta_description' => 'nullable|string',
            'is_active' => 'boolean',
            'status' => 'required|in:draft,invisible,published',
        ];

        // Only validate slug if the page is not a core page
        if (! $page->is_core) {
            $rules['slug'] = [
                'required',
                'string',
                'max:255',
                Rule::unique('pages')->ignore($page->id),
            ];
        }

        $validated = $request->validate($rules);

        // Prevent updating slug for core pages, just in case the request contains it
        if ($page->is_core && isset($validated['slug'])) {
            unset($validated['slug']);
        }

        $page->update($validated);

        return response()->json($page);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Page $page)
    {
        if ($page->is_core) {
            return response()->json([
                'message' => __('This is a required legal page and cannot be deleted.')
            ], Response::HTTP_FORBIDDEN);
        }

        $page->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Remove the specified resources from storage.
     */
    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:pages,id',
        ]);

        // Delete pages that are not core
        Page::whereIn('id', $validated['ids'])
            ->where('is_core', false)
            ->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }
}
