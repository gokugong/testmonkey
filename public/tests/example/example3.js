var example = 0;

testSuite("Example that has setup",
{
	setup:function()
	{
		example = 1;
		this.foo = example;
	},
	run:function()
	{
		test("make sure that our setup ran",function()
		{
			assert( example == 1 );
			assert( this.foo == example );
		});
	}
})
