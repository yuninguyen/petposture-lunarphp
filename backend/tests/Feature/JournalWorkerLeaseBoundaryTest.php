<?php

namespace Tests\Feature;

use Tests\TestCase;

class JournalWorkerLeaseBoundaryTest extends TestCase
{
    public function test_actual_numeric_predicate_rejects_worker_at_or_above_lease_independently(): void
    {
        // Evaluate only the actual command's pure numeric predicate with controlled
        // local inputs: no production timeout override or new runtime abstraction.
        $source = file_get_contents(app_path('Console/Commands/CheckStorefrontRefreshReadiness.php'));
        $this->assertSame(1, preg_match('/if \((.*?)\) \{/s', $source, $match));
        $predicate = $match[1];
        $queue = ['driver' => 'database'];
        $request = 60;
        $io = 5;
        $visibility = 300;
        foreach ([60 => false, 119 => false, 120 => true, 180 => true] as $worker => $rejected) {
            $this->assertSame($rejected, eval('return '.$predicate.';'), "worker={$worker}, visibility=300");
        }
    }
}
