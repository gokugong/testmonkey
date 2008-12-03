
$(document).ready(function() {

	TestMonkey.installTestRunnerPlugin({
		onManifestLoaded: function ()
		{
			var testSuiteNames = [];
			$.each(testSuites, function(name,val) {
				testSuiteNames.push(name);
			});
			
			testRunner(testSuiteNames);
		}
	});
});