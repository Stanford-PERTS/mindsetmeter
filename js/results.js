// results.js
//
// Powers analysis of MM2-style responses and related chart rendering.
//
// Some differences from MM1:
//
// * Specialized answer fields: pid, phase
// * Multiple time points in answers which need to be separated by phase.
//
// To use: provide the right inputs to the set functions based on your report,
// then call mmReport.renderAllPhases(). See the  mm2-demo files for examples.

var mmReport = (function () {
    'use strict';
    /* global mm, JSON, Chart, util */

    var graphDataTemplate, countsTemplate,
        calculateMetrics,
        renderPhase;

    var setTemplates = function (graphData, counts) {
        graphDataTemplate = graphData;
        countsTemplate = counts;
    };

    var setMetricCalculator = function (func) {
        calculateMetrics = func;
    };

    var setPhaseRenderer = function (func) {
        renderPhase = func;
    };

    // Turn each count into a % of the total.
    var calculateProportions = function (phaseContext) {
        var p = phaseContext;
        for (var metric in p.counts) {
            p.proportions[metric] = {};
            for (var level in p.counts[metric]) {
                var prop = (p.counts[metric][level] /
                            p.counts[metric].total);
                if (level !== "total") {
                    p.proportions[metric][level] = Math.round(prop * 100);
                }
            }
        }
    };

    var buildContext = function (metric, answers, phaseOrdinal) {
        // "Phase context", a container for phase calculations.
        var p = {
            phaseOrdinal: phaseOrdinal,
            answers: answers,
            counts: {},  // count data by category
            proportions: {},  // proportion data by category
            graphData: {}  // data used by chart.js
        };
        p.graphData[metric] = util.jsonCopy(graphDataTemplate);
        p.counts[metric] = util.jsonCopy(countsTemplate);

        return p;
    };

    var renderPieChart = function (proportions, graphData, chartId) {
        for (var i in graphData) {
            var level = graphData[i].title;
            graphData[i].value = proportions[level];
        }
        var context = document.getElementById(chartId).getContext("2d");
        var gmsChart = new Chart(context).Pie(graphData);
    };

    var renderAllPhases = function (metric, answers) {
        var s = splitAnswers(answers);
        s.forEach(function (answers, phaseOrdinal) {
            var phaseContext = buildContext(metric, answers, phaseOrdinal);
            answers.forEach(function (answerSet) {
                calculateMetrics(answerSet, metric, phaseContext);
            });
            calculateProportions(phaseContext);
            renderPhase(metric, phaseContext);
        });
        return s;
    };

    // Splits an array of answer sets (all phases munged together) into an
    // array of arrays, separated by phase. Note that the array indices are the
    // phase ordinals, which count from 1, not 0.
    // Returns:
    // [
    //     undefined,
    //     [
    //         {phase: 1, toi.1: 3, toi.2: 1},  // "answer set"
    //         {phase: 1, toi.1: 1, toi.2: 4},
    //         ...
    //     ],
    //     [
    //         {phase: 2, toi.1: 3, toi.2: 1},
    //         {phase: 2, toi.1: 5, toi.2: 6},
    //         ...
    //     ],
    //     ...
    // ]
    var splitAnswers = function (answers) {
        var answersByPhase = [];
        answers.forEach(function (answerSet) {
            var phaseOrdinal = parseInt(answerSet.phase, 10);

            if (isNaN(phaseOrdinal)) {
                // This shouldn't happen; the answers don't have a phase.
                // The cleanest thing to do seems to be to log and error and
                // move on.
                if (console && typeof console.error === 'function') {
                    console.error("Answer has no phase:", answerSet);
                }
                return;
            }
            // If we haven't encountered this phase before, initialize the
            // array for this index.
            if (!(phaseOrdinal in answersByPhase)) {
                answersByPhase[phaseOrdinal] = [];
            }
            answersByPhase[phaseOrdinal].push(answerSet);
        });
        return answersByPhase;
    };

    return {
        setTemplates: setTemplates,
        setMetricCalculator: setMetricCalculator,
        setPhaseRenderer: setPhaseRenderer,
        renderPieChart: renderPieChart,
        renderAllPhases: renderAllPhases
    };

}());
