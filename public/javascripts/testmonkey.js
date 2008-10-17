(function(scope,$){

	var testRunnerPlugin = null;
	
	function fireEvent()
	{
		if (testRunnerPlugin)
		{
			var name = arguments[0], args = arguments.length > 1 ? $.makeArray(arguments).slice(1) : [];
			var fn = testRunnerPlugin[name];
			if (fn)
			{
				fn.apply(testRunnerPlugin,args);
			}
			// support a catch-all event handler
			fn = testRunnerPlugin['onEvent'];
			if (fn)
			{
				args.unshift(name);
				fn.apply(testRunnerPlugin,args);
			}
		}
	}

	scope.installTestRunnerPlugin = function(callback)
	{
		testRunnerPlugin = callback;
	};
	
	var currentDescriptor = null, currentSuite = null;
	
	scope.testRunner = function()
	{
		// cleanup in case we call this multiple times
		currentDescriptor = currentSuite = currentTestCase = null;
		testCases = [];
		
		var suites = [];
		var it = typeof(arguments[0].push)=='function' ? arguments[0] : arguments;
		$.each(it,function()
		{
			var descriptor = testSuites[this];
			if (descriptor)
			{
				suites.push([this,descriptor]);
			}
		});

		fireEvent('beforeTestRunner',suites);
		
		// we first have to run through them so all the tests can be recorded
		// they won't run at this point
		$.each(suites,function()
		{
			var descriptor = currentDescriptor = this[1];
			var name = currentSuite = this[0];
			var error = false;
			try
			{
				descriptor.run();
			}
			catch(E)
			{
				error = E;
			}
			currentDescriptor = null;
		});

		// set it to the first one in the list
		currentSuite = null;
		if (currentSuite) fireEvent('beforeTestSuite',suites[0][0]);

		fireEvent('beforeTestCases',testCases);

		$.each(testCases,function()
		{
			var testcase = this;
			testcase.running = false;
			testcase.ready = true;
		});
		
		var total = 0, loaded = 0;

		// we need to load any pending HTML for the test
		// and then wait until they're all complete before we 
		// start running the test cases
		$.each(suites,function()
		{
			var descriptor = this[1];
			var html = descriptor.html;
			if (html)
			{
				total+=1;
				loadTestFrame(html,function(id)
				{
					// mark the id for the frame onto the descriptor
					descriptor.htmlID = id;
					loaded+=1;
					if (loaded == total)
					{
						executeNextTestCase();
					}
				});
			}
		});

		if (total==0)
		{
			executeNextTestCase();
		}
	}
	
	function executeNextTestCase()
	{
		var nextTestCase = null;
		$.each(testCases,function()
		{
			if (this.ready)
			{
				nextTestCase = this;
				return false;
			}
		});
		
		if (nextTestCase)
		{
			if (currentSuite!=nextTestCase.suite)
			{
				if (currentSuite) fireEvent('afterTestSuite',currentSuite);
				currentSuite = nextTestCase.suite;
				fireEvent('beforeTestSuite',currentSuite);
			}
			nextTestCase.ready = false;
			var testcase = nextTestCase;
			fireEvent('beforeTestCase',testcase);
			var descriptor = testcase.descriptor;
			if (descriptor.setup) try { descriptor.setup(); } catch (E) {}
			var error = false;
			try
			{
				executeTest(testcase,descriptor);
			}
			catch(E)
			{
				error = E;
				testcase.running = false;
				testcase.error = E;
				testcase.message = "Exception running testcase: "+E;
			}
		}
		else
		{
			if (currentSuite) fireEvent('afterTestSuite',currentSuite);
			fireEvent('afterTestCases',testCases);
			fireEvent('afterTestRunner');
		}
	}

	function runAssertion(value)
	{
		switch(typeof(value))
		{
			case 'boolean':
				return value===true;
			case 'function':
				value = $.toFunction('(' + String(value) + ')()')();
				return (value) ? true : false;
			default:
				return (value) ? true : false;
		}
	}
	
	function internalAssert()
	{
		var idx = arguments[0], type = arguments[1]||'';
		var args = $.makeArray(arguments).splice(2);
		var result = null;
		var testcase = currentTestCase;
		var assert = testcase.asserts[idx];
		var target = this;
		try
		{
			switch(type)
			{
				case '':
				{
					result = runAssertion(args[0]);
					break;
				}
				case 'Visible':
				{
					break;
				}
				case 'CSS':
				{
					result = target.css(args[0]) == args[1];
					break;
				}
				default:
				{
					break;
				}
			}
			testcase.results.push({assert:assert,result:result,idx:idx});
		}
		catch (E)
		{
			testcase.results.push({assert:assert,result:false,error:E,message:String(E),idx:idx});
		}
	}
	
	var currentTestCase = null;
	
	$.fn.assertTestCase = function()
	{
		internalAssert.apply(this,arguments);
		return this;
	};
	
	function executeTest(testcase,descriptor)
	{
		testcase.results = [];
		testcase.running = true;
		currentTestCase = testcase;
		var timer = null;
		function assertTestCase()
		{
			if (testcase.running)
			{
				internalAssert.apply(window,arguments);
			}
		}
		function $(selector)
		{ 
			return jQuery("#"+descriptor.htmlID).contents().find(selector);
		}
		function fail(msg)
		{
			testcase.message = msg;
			testcase.explicitFailure = true;
			end(true,false);
		}
		function end(failed,timeout)
		{
			if (!testcase.running) return;
			if (timer)
			{
				clearTimeout(timer);
				timer=null;
			}
			testcase.running = false;
			if (failed)
			{
				testcase.failed = true;
			}
			else
			{
				var passed = true;
				jQuery.each(testcase.results,function()
				{
					if (!this.result)
					{
						passed=false;
						return false;
					}
				});
				testcase.failed = !passed;
				if (passed && !testcase.message) testcase.message ="Assertions Passed";
				if (!passed && !testcase.message) testcase.message = "Assertion Failures";
			}
			if (timeout)
			{
				testcase.timeout = true;
				testcase.message = "Timed out";
			}
			if (descriptor.teardown) try { descriptor.teardown(); } catch (E) {}
			fireEvent('afterTestCase',testcase,descriptor);
			executeNextTestCase();
		}
		try
		{
			var f = eval('('+testcase.code+')');
			f.call(descriptor);
			if (typeof(testcase.timeout)=='undefined')
			{
				end(false,false);
			}
			else
			{
				timer=setTimeout(function(){end(true,true)},testcase.timeout);
			}
		}
		catch(E)
		{
			testcase.failed = true;
			testcase.error = E;
			testcase.message = "Exception running testcase: "+E;
			end(true,false);
		}
	}
	
	scope.extractCodeLine = function (code,expr)
	{
		var result = expr;
		var idx = code.indexOf(expr);
		if (idx!=-1)
		{
			var end = idx + expr.length;
			idx--;
			// back up to the beginning of the line
			while ( idx >= 0)
			{
				var ch = code.charAt(idx);
				if (ch == ';' || ch=='\n' || ch=='\r')
				{
					break;
				}
				result = ch + result;
				idx--;
			}
			// go to the end of the line
			while ( end < code.length )
			{
				var ch = code.charAt(end);
				result = result + ch;
				if (ch == ';' || ch=='\n' || ch=='\r')
				{
					break;
				}
				end++;
			}
		}
		return result;
	}
	
	var testFrameId = 1;
	
	function loadTestFrame(url,fn)
	{
		var id = ++testFrameId;
		url = URI.absolutizeURI(url,AppC.docRoot+'tests/');
		$("<iframe id='test_"+id+"' src='"+url+"' frameborder='0' height='1' width='1' style='position:absolute;left:-100px;top:-10px;'></iframe>").appendTo("body");
		$("#test_"+id).load(function()
		{
			fn('test_'+id);
		});
	}
	
	function escapeString(str)
	{
		return $.gsub(str,'"',"\\\"");
	}
	
	function preProcessCode(code)
	{
		var re = /assert(.*?)[\s]?\((.*)?\)/;
		var _asserts = [];
		var newcode = $.gsub(code,re,function(m)
		{
			_asserts.push(m[0]); 
			var prefix = m[1] ? '"' + escapeString(m[1]) + '"' : 'null';
			var params = m[2];
			return 'assertTestCase(' + (_asserts.length-1) + ','+prefix+','+params+')';
		});
		var asserts = [];
		$.each(_asserts,function()
		{
			asserts.push(extractCodeLine(code,this));
		});
		return { asserts: asserts,code: newcode }
	}
	
	var testCases = [];

	scope.testAsync = function()
	{
		var name = arguments[0], timeout = 10000, fn = null;
		if (arguments.length == 2) 
		{
			fn = arguments[1];
		}
		else
		{
			timeout = arguments[1];
			fn = arguments[2];
		}
		var results = preProcessCode(String(fn));
		testCases.push({
			name: name,
			code: results.code,
			testcase: String(fn),
			timeout: timeout,
			asserts: results.asserts,
			descriptor: currentDescriptor,
			suite:currentSuite
		});
	}
	
	scope.test = function()
	{
		var name = arguments[0], fn = arguments[1];
		var results = preProcessCode(String(fn));
		testCases.push({
			name: name,
			code: results.code,
			testcase: String(fn),
			asserts: results.asserts,
			descriptor: currentDescriptor,
			suite:currentSuite
		});
	};
	
	var testSuites = {};
	
	scope.testSuite = function(name,html,descriptor)
	{
		if (typeof(html)!='string')
		{
			descriptor = html;
			html = null;
		}
		
		descriptor.html=html;
		testSuites[name]=descriptor;
		
		fireEvent("addTestSuite",name,descriptor,html);
		
		this.run = function()
		{
			testRunner(name);
		}
		
		return this;
	}
	
})(window,jQuery);

