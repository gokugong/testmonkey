testSuite("Example that uses external HTML content","example/example.html",
{
	run:function()
	{
		test("make sure that our setup ran",function()
		{
			assert($("#test").html() == 'Hello');
			$('body').assertCSS('visibility','visible');
		});
	}
})
