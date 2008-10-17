$(document).ready(function()
{
	$.getJSON(AppC.docRoot+'tests/manifest.js',function(json)
	{
		$.each(json.suites,function()
		{
			$.getScript(AppC.docRoot+'tests/'+this);
		});
	});
	
	$("#run").on("click",function()
	{
		$("#results").empty();
		testRunner($("#selector select").val());
	});

	$("#runall").on("click",function()
	{
		$("#results").empty();
		var select = $("#selector select").get(0);
		var tests = [];
		for (var c=0;c<select.length;c++)
		{
			tests.push(select.options[c].text);
		}
		testRunner(tests);
	});
	
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
	var testCount = 0;
	var suiteCount = 0;
	var assertCount = 0;
	
	installTestRunnerPlugin({
		
		onEvent: function(name,result)
		{
			switch(name)
			{
				case 'addTestSuite':
				{
					$("#selector select").append("<option>"+result+"</option>");
					break;
				}
				case 'beforeTestSuite':
				{
					$("#results").append("<table><thead><td>Suite</td><td>Passed</td><td>Failed</td><td>Errors</td></thead><tr><td><div class='testsuite'>"+result+"</div></td>");
					break;
				}
				case 'beforeTestRunner':
				{
					suiteCount = result.length;
					$('#suite_count').html(suiteCount);
					break;
				}
				case 'beforeTestCases':
				{
					testCount = result.length;
					$('#test_count').html(result.length);
					$('#summary').css('display','block')
					break;
				}
				case 'beforeTestCase':
				{
					assertCount +=result.asserts.length;
					$('#assert_count').html(assertCount)

					break;
				}
				case 'afterTestSuite':
				{
					$("#results").append("</tr>");
					break;
				}
				case 'afterTestCase':
				{
					try
					{
						var errorMessage = result.testcase;
						var failedCount = 0;
						$.info('result.results ' + result.results)
						$.each(result.results,function()
						{
							failedCount +=this.result ? 0 : 1;
							var cls = this.result ? 'passed' : 'failed';
							
							var idx = errorMessage.indexOf(this.assert);
							$.info('error ' +this.error)

							if (this.error)
							{
								$('#status_bar').append('<div class="error_bar"></div>');
							}
							else if (cls=='passed')
							{
								$('#status_bar').append('<div class="passed_bar"></div>');
							}
							else 
							{
								$('#status_bar').append('<div class="failed_bar"></div>');								
							}

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
						var html = "<div style='display:none' class='testdetail' id='test_"+id+"'><div class='testresult "+(result.failed?'failed':'passed')+"'>"+(result.error ? 'Error' : result.failed?('Failed <span class="count">('+failedCount+')</span>'):'Passed')+"</div><div>"+result.name+"</div></div><div class='clear'></div>"; 
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

