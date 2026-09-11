<?php
namespace Tests\Feature;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;
class JournalReadinessBoundaryTest extends TestCase
{
    public static function compatible(): array { return [['database',120],['database',180],['redis',90],['beanstalkd',90]]; }
    #[DataProvider('compatible')]
    public function test_compatible_numbers_do_not_certify_activation(string $driver, int $visibility): void
    {
        config(['queue.default'=>'test', 'queue.connections.test'=>['driver'=>$driver,'retry_after'=>$visibility]]);
        $this->artisan('storefront:refresh-readiness',['--request-timeout'=>60,'--io-timeout'=>5])
            ->expectsOutput('Numeric checks passed: Cloudflare HTTP 5s < job 60s < queue visibility; job < lease 120s. Initial synchronous work is not governed by the job timeout.')
            ->assertExitCode(1);
    }
    public static function incompatible(): array
    {
        return [[60,5,60,'database'],[60,60,90,'database'],[90,60,90,'database'],[0,5,90,'database'],['bad',5,90,'database'],[60,0,90,'database'],[60,'bad',90,'database'],[60,5,null,'database'],[60,5,'bad','database'],[60,5,90,'sqs']];
    }
    #[DataProvider('incompatible')]
    public function test_invalid_bounds_fail_numeric_check($request,$io,$visibility,$driver): void
    {
        config(['queue.default'=>'test','queue.connections.test'=>['driver'=>$driver,'retry_after'=>$visibility]]);
        $this->artisan('storefront:refresh-readiness',['--request-timeout'=>$request,'--io-timeout'=>$io])
            ->expectsOutput('Not ready: require verified request < 120s, IO < min(request, worker), and async worker < visibility with worker < 120s. Unknown bounds fail closed.')
            ->assertExitCode(1);
    }
}
