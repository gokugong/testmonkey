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
		var suites = [];
		$.each(arguments,function()
		{
			var descriptor = testSuitesByName[this];
			if (descriptor)
			{
				suites.push([this,descriptor]);
			}
			else
			{
				$.error("invalid test suite: "+this);
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
				$.error("Error setting of test case:"+descriptor.name+", Error: "+E);
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
		
		executeNextTestCase();
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
		// var isGlobal = false;
		// if (this == window)
		// {
		// 	isGlobal = true;
		// 	target = $(args[0]);
		// 	args = args.slice(1);
		// }
		
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
					$.error('type = '+type);
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
//		$.info('execute test case with '+testcase.name+', code='+testcase.code);
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
				$.each(testcase.results,function()
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
			$.info('test case passed = '+!testcase.failed);
			if (descriptor.teardown) try { descriptor.teardown(); } catch (E) {}
			fireEvent('afterTestCase',testcase,descriptor);
			executeNextTestCase();
		}
		try
		{
			eval('('+testcase.code+')()');
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
	
	function preProcessCode(code)
	{
		var re = /assert(.*)?[\s]?\((.*)?\)/;
		var _asserts = [];
		var newcode = $.gsub(code,re,function(m)
		{
			_asserts.push(m[0]); 
			var prefix = m[1] ? '"' + m[1] + '"' : 'null';
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
	
	var testSuites = [];
	var testSuitesByName = {};
	
	scope.testSuite = function(name,descriptor)
	{
		testSuites.push({name:name,descriptor:descriptor});
		testSuitesByName[name]=descriptor;
		
		this.run = function()
		{
			testRunner(name);
		}
		
		return this;
	}
	
})(window,jQuery);

$(document).ready(function()
{
	function leadingWhitepsace(code)
	{
		var count = 0;
		var spacing = '';
		while (true)
		{
			var ch = code.charAt(count);
			if (ch != ' ')
			{
				break;
			}
			count++;
			spacing+=' ';
		}
		return spacing;
	}
	
	var idCounter = 1;
	
	installTestRunnerPlugin({
		onEvent: function(name,result)
		{
			$.info(name);
			switch(name)
			{
				case 'beforeTestSuite':
				{
					$("#results").append("<div class='testsuite'>Test Suite: "+result+"</div>");
					break;
				}
				case 'afterTestSuite':
				{
					$("#results").append("<div class='end_testsuite'></div>");
					break;
				}
				case 'afterTestCase':
				{
					try
					{
						var errorMessage = result.testcase;
						var failedCount = 0;
						$.each(result.results,function()
						{
							failedCount+=this.result ? 0 : 1;
							var cls = this.result ? 'passed' : 'failed';
							var idx = errorMessage.indexOf(this.assert);
							if (idx != -1)
							{
								var newMessage = errorMessage.substring(0,idx);
								var line = errorMessage.substring(idx,idx+this.assert.length);
								newMessage+=leadingWhitepsace(line);
								newMessage+='<span class="'+cls+'">';
								newMessage+=$.trim(line);
								newMessage+='</span>';
								if (this.error)
								{
									newMessage+='<span class="error">'+this.error+'</span>';	
								}
								else if (!this.result && this.message)
								{
									newMessage+='<span class="error">'+this.message+'</span>';	
								}
								newMessage+=errorMessage.substring(idx+this.assert.length);
								errorMessage = newMessage;
							}
						});
						if (result.explicitFailure)
						{
							if (failedCount==0) failedCount=1;
							var re = /fail[\s]?\((.*)?\)/;
							var matches = [];
							errorMessage=$.gsub(errorMessage,re,function(m)
							{
								if (m[0].indexOf(result.message) > 0)
								{
									matches.push(extractCodeLine(errorMessage,m[0]));
								}
								return m[0];
							});
							$.each(matches,function()
							{
								var idx = errorMessage.indexOf(this);
								var newMessage = errorMessage.substring(0,idx);
								var line = errorMessage.substring(idx,idx+this.length);
								newMessage+=leadingWhitepsace(line);
								newMessage+='<span class="failed">';
								newMessage+=$.trim(line);
								newMessage+='</span>';
								newMessage+=errorMessage.substring(idx+this.length);
								errorMessage=newMessage;
							});
						}
						if (typeof(result.timeout)!='undefined')
						{
							errorMessage = 'testAsync("' + result.name + '",'+result.timeout+',<span class="fn">'+errorMessage+'</span>);'
						}
						else
						{
							errorMessage = 'test("' + result.name + '",<span class="fn">'+errorMessage+'</span>);'
						}
						var id = idCounter++;
						var html = "<div class='testdetail' id='test_"+id+"'><div class='testresult "+(result.failed?'failed':'passed')+"'>"+(result.error ? 'Error' : result.failed?('Failed <span class="count">('+failedCount+')</span>'):'Passed')+"</div><div>"+result.name+"</div></div><div class='clear'></div>"; 
						html+="<div id='test_detail_"+id+"' style='display:none' class='result "+(result.error?'error':'')+"'>";
						html+=errorMessage;
						if (result.error)
						{
							html+="<div class='error_msg'>" + result.error + "</div>";
						}
						html+="</div>";
						$("#results").append(html);
						$("#test_"+id).click(function()
						{
							var t = $("#test_detail_"+id);
							t.css('display') == 'none' ? t.css("display","block") : t.css("display","none");
						});
					}
					catch (E)
					{
						$.error(E);
					}
					break;
				}
			}
		}
	});
});

