function renderMath(element) {
    if (!window.renderMathInElement) {
        return
    }

    renderMathInElement(element, {
        delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true }
        ],
        throwOnError: false
    })
}

const savedStrengthsStorageKey = "wc-prediction-strengths"
const applyFixedGameOutcomesStorageKey = "wc-prediction-apply-fixed-game-outcomes"
const defaultTeamStrengths = new Map(teams.map(team => [team.isoId, team.strength]))
loadSavedStrengths()

let latestSimulationSummary = null
const strengthSliderControls = []

function loadSavedStrengths() {
    const savedStrengths = localStorage.getItem(savedStrengthsStorageKey)

    if (!savedStrengths) {
        return
    }

    try {
        const strengthsByTeam = JSON.parse(savedStrengths)

        for (const team of teams) {
            const strength = strengthsByTeam[team.isoId]

            if (typeof strength === "number" && strength >= 0.1 && strength <= 10) {
                team.strength = strength
            }
        }
    } catch {
        localStorage.removeItem(savedStrengthsStorageKey)
    }
}

function saveStrengths() {
    const strengthsByTeam = {}

    for (const team of teams) {
        strengthsByTeam[team.isoId] = team.strength
    }

    localStorage.setItem(savedStrengthsStorageKey, JSON.stringify(strengthsByTeam))
}

async function loadFixedGameOutcomes() {
    try {
        const response = await fetch("api/get_results.php", { cache: "no-store" })

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`)
        }

        const results = await response.json()

        if (!Array.isArray(results)) {
            throw new Error("Expected an array of results")
        }

        FIXED_GAME_OUTCOMES = results
            .filter(result => typeof result?.winner === "string" && typeof result?.loser === "string")
            .map(result => [result.winner, result.loser])
    } catch (error) {
        console.error("Could not load fixed game outcomes", error)
        FIXED_GAME_OUTCOMES = []
    }
}

function hasFixedGameOutcomes() {
    return typeof FIXED_GAME_OUTCOMES !== "undefined"
        && Array.isArray(FIXED_GAME_OUTCOMES)
        && FIXED_GAME_OUTCOMES.length > 0
}

function loadApplyFixedGameOutcomes() {
    if (!hasFixedGameOutcomes()) {
        return false
    }

    const savedValue = localStorage.getItem(applyFixedGameOutcomesStorageKey)

    if (savedValue === null) {
        return true
    }

    return savedValue === "true"
}

function saveApplyFixedGameOutcomes(shouldApply) {
    localStorage.setItem(applyFixedGameOutcomesStorageKey, String(shouldApply))
}

function initFixedGameOutcomesControl() {
    if (!elements.fixedGamesControl || !elements.applyFixedGameOutcomesCheckbox) {
        Tournament.applyFixedGameOutcomes = false
        return
    }

    if (!hasFixedGameOutcomes()) {
        elements.fixedGamesControl.hidden = true
        Tournament.applyFixedGameOutcomes = false
        return
    }

    const shouldApplyFixedGameOutcomes = loadApplyFixedGameOutcomes()
    elements.fixedGamesControl.hidden = false
    elements.applyFixedGameOutcomesCheckbox.checked = shouldApplyFixedGameOutcomes
    Tournament.applyFixedGameOutcomes = shouldApplyFixedGameOutcomes

    elements.applyFixedGameOutcomesCheckbox.addEventListener("change", () => {
        Tournament.applyFixedGameOutcomes = elements.applyFixedGameOutcomesCheckbox.checked
        saveApplyFixedGameOutcomes(Tournament.applyFixedGameOutcomes)
        recomputeAnalysis()
    })
}

function areStrengthsAtDefault() {
    return teams.every(team => Math.abs(team.strength - defaultTeamStrengths.get(team.isoId)) < 0.000001)
}

function updateResetStrengthsButton() {
    if (!elements.resetStrengthsButton) {
        return
    }

    elements.resetStrengthsButton.disabled = areStrengthsAtDefault()
}

function resetStrengths() {
    for (const control of strengthSliderControls) {
        const defaultStrength = defaultTeamStrengths.get(control.team.isoId)
        control.team.strength = defaultStrength
        control.slider.value = defaultStrength
        control.labelText.textContent = control.team.getShowString()
        renderMath(control.label)
    }

    updateResetStrengthsButton()
    localStorage.removeItem(savedStrengthsStorageKey)
    recomputeAnalysis()
}

function initStrengthSliders() {
    for (const team of teams) {
        const slider = document.createElement("input")
        slider.type = "range"
        slider.min = "0.1"
        slider.max = "10"
        slider.step = "0.1"
        slider.value = team.strength

        const label = document.createElement("label")
        const labelText = document.createElement("span")
        labelText.textContent = team.getShowString()

        const flagImage = document.createElement("img")
        flagImage.src = team.getFlagSource()
        flagImage.alt = `Flag of ${team.name}`

        label.appendChild(labelText)

        elements.strengthSliders.appendChild(flagImage)
        elements.strengthSliders.appendChild(label)
        elements.strengthSliders.appendChild(slider)
        strengthSliderControls.push({ team, slider, label, labelText })

        slider.addEventListener("input", () => {
            team.strength = parseFloat(slider.value)
            labelText.textContent = team.getShowString()
            renderMath(label)
            updateResetStrengthsButton()
        })

        slider.addEventListener("change", () => {
            saveStrengths()
            recomputeAnalysis()
        })

        renderMath(elements.strengthSliders)
    }

    updateResetStrengthsButton()
}

function getTeamWinProbability(teamA, teamB) {
    return Tournament.getWinProbability(teamA, teamB)
}

function createEmptyProbabilitySummary(team) {
    return {
        team,
        octofinal: 0,
        quarterfinal: 0,
        semifinal: 0,
        final: 0,
        third: 0,
        second: 0,
        winFrequency: 0
    }
}

function addProbability(summaryMap, isoId, key, probability) {
    summaryMap.get(isoId)[key] += probability
}

function computeTournamentProbabilities() {
    const summaryMap = new Map(teams.map(team => [team.isoId, createEmptyProbabilitySummary(team)]))
    let roundProbabilities = teams.map(team => {
        return new Map([[team.isoId, {
            team,
            probability: 1
        }]])
    })
    const stageKeys = ["octofinal", "quarterfinal", "semifinal", "final", "winFrequency"]
    const semifinalLoserMaps = []

    for (let roundI = 0; roundI < 5; roundI++) {
        const nextRoundProbabilities = []

        for (let i = 0; i < roundProbabilities.length; i += 2) {
            const leftBracket = roundProbabilities[i]
            const rightBracket = roundProbabilities[i + 1]
            const winnerProbabilities = new Map()
            const loserProbabilities = new Map()

            for (const leftEntry of leftBracket.values()) {
                for (const rightEntry of rightBracket.values()) {
                    const teamA = leftEntry.team
                    const teamB = rightEntry.team
                    const matchupProbability = leftEntry.probability * rightEntry.probability
                    const teamAWinProbability = getTeamWinProbability(teamA, teamB)
                    const teamBWinProbability = 1 - teamAWinProbability
                    const previousTeamAProbability = winnerProbabilities.get(teamA.isoId)?.probability ?? 0
                    const previousTeamBProbability = winnerProbabilities.get(teamB.isoId)?.probability ?? 0
                    const previousTeamALoserProbability = loserProbabilities.get(teamA.isoId)?.probability ?? 0
                    const previousTeamBLoserProbability = loserProbabilities.get(teamB.isoId)?.probability ?? 0

                    winnerProbabilities.set(teamA.isoId, {
                        team: teamA,
                        probability: previousTeamAProbability + matchupProbability * teamAWinProbability
                    })
                    winnerProbabilities.set(teamB.isoId, {
                        team: teamB,
                        probability: previousTeamBProbability + matchupProbability * teamBWinProbability
                    })

                    if (roundI === 3) {
                        loserProbabilities.set(teamA.isoId, {
                            team: teamA,
                            probability: previousTeamALoserProbability + matchupProbability * teamBWinProbability
                        })
                        loserProbabilities.set(teamB.isoId, {
                            team: teamB,
                            probability: previousTeamBLoserProbability + matchupProbability * teamAWinProbability
                        })
                    }

                    if (roundI === 4) {
                        addProbability(summaryMap, teamA.isoId, "second", matchupProbability * teamBWinProbability)
                        addProbability(summaryMap, teamB.isoId, "second", matchupProbability * teamAWinProbability)
                    }
                }
            }

            nextRoundProbabilities.push(winnerProbabilities)

            for (const winnerEntry of winnerProbabilities.values()) {
                addProbability(summaryMap, winnerEntry.team.isoId, stageKeys[roundI], winnerEntry.probability)
            }

            if (roundI === 3) {
                semifinalLoserMaps.push(loserProbabilities)
            }
        }

        roundProbabilities = nextRoundProbabilities
    }

    const [leftSemifinalLosers, rightSemifinalLosers] = semifinalLoserMaps

    for (const leftEntry of leftSemifinalLosers.values()) {
        for (const rightEntry of rightSemifinalLosers.values()) {
            const teamA = leftEntry.team
            const teamB = rightEntry.team
            const matchupProbability = leftEntry.probability * rightEntry.probability
            const teamAWinProbability = getTeamWinProbability(teamA, teamB)

            addProbability(summaryMap, teamA.isoId, "third", matchupProbability * teamAWinProbability)
            addProbability(summaryMap, teamB.isoId, "third", matchupProbability * (1 - teamAWinProbability))
        }
    }

    return Array.from(summaryMap.values())
}

function computeWinProbabilites() {
    return new Map(computeTournamentProbabilities().map(result => {
        return [result.team.isoId, result.winFrequency]
    }))
}

function getVisibleChartTeamCount() {
    const chartWidth = elements.simulationResultsChart.parentElement.clientWidth
    return Math.max(5, Math.min(12, Math.floor(chartWidth / 90)))
}

function updateSimulationResultsChart(summary) {
    if (!elements.simulationResultsChart || !window.drawBarChart) {
        return
    }

    latestSimulationSummary = summary
    const topTeams = summary
        .slice(0, getVisibleChartTeamCount())
        .sort((a, b) => b.winFrequency - a.winFrequency)

    drawBarChart(elements.simulationResultsChart, topTeams.map(result => {
        return {
            teamId: result.team.isoId,
            label: result.team.name,
            value: result.winFrequency,
            flagSource: result.team.getFlagSource()
        }
    }), {
        xAxisTitle: "Teams sorted by tournament win probability",
        yAxisTitle: "Tournament win probability",
        onBarClick: item => scrollToProbabilityCard(item.teamId)
    })
}

function formatProbability(probability) {
    return `${(probability * 100).toFixed(2)}\\%`
}

function createProbabilityRow(label, probability, formatFunc=formatProbability) {
    const fragment = document.createDocumentFragment()
    const term = document.createElement("dt")
    const value = document.createElement("dd")

    term.textContent = label
    value.textContent = `$${formatFunc(probability)}$`
    fragment.appendChild(term)
    fragment.appendChild(value)

    return fragment
}

function updateProbabilityGrid(summary) {
    if (!elements.probabilityGrid) {
        return
    }

    elements.probabilityGrid.replaceChildren()

    for (const result of summary) {
        const card = document.createElement("article")
        const header = document.createElement("div")
        const flagImage = document.createElement("img")
        const name = document.createElement("span")
        const probabilityList = document.createElement("dl")

        card.classList.add("probability-card")
        card.dataset.teamId = result.team.isoId
        header.classList.add("probability-card-header")
        flagImage.src = result.team.getFlagSource()
        flagImage.alt = `Flag of ${result.team.name}`
        name.textContent = `${result.team.name}`

        header.appendChild(flagImage)
        header.appendChild(name)
        probabilityList.appendChild(createProbabilityRow("Winning", result.winFrequency))
        probabilityList.appendChild(createProbabilityRow("Second place", result.second))
        probabilityList.appendChild(createProbabilityRow("Third place", result.third))
        probabilityList.appendChild(createProbabilityRow("Reaching Final", result.final))
        probabilityList.appendChild(createProbabilityRow("Reaching Semifinal", result.semifinal))
        probabilityList.appendChild(createProbabilityRow("Reaching Quarterfinal", result.quarterfinal))
        probabilityList.appendChild(createProbabilityRow("Reaching Octofinal", result.octofinal))
        probabilityList.appendChild(createProbabilityRow("Strength", result.team.strength, s => s.toFixed(1)))
        card.appendChild(header)
        card.appendChild(probabilityList)
        elements.probabilityGrid.appendChild(card)
    }

    renderMath(elements.probabilityGrid)
}

function scrollToProbabilityCard(teamId) {
    const card = elements.probabilityGrid?.querySelector(`[data-team-id="${teamId}"]`)

    if (!card) {
        return
    }

    card.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest"
    })
}

window.scrollToProbabilityCard = scrollToProbabilityCard

function initSimulationResultsChartResize() {
    if (!elements.simulationResultsChart) {
        return
    }

    const chartContainer = elements.simulationResultsChart.parentElement
    let resizeAnimationFrame = null

    const redrawChart = () => {
        if (resizeAnimationFrame) {
            cancelAnimationFrame(resizeAnimationFrame)
        }

        resizeAnimationFrame = requestAnimationFrame(() => {
            resizeAnimationFrame = null

            if (latestSimulationSummary) {
                updateSimulationResultsChart(latestSimulationSummary)
            }
        })
    }

    const redrawChartImmediately = () => {
        if (latestSimulationSummary) {
            updateSimulationResultsChart(latestSimulationSummary)
        }
    }

    if (window.ResizeObserver) {
        new ResizeObserver(redrawChart).observe(chartContainer)
    }

    window.addEventListener("resize", redrawChart)
    window.addEventListener("orientationchange", redrawChartImmediately)
}

function recomputeAnalysis() {
    const summary = computeTournamentProbabilities()
        .sort((a, b) => b.winFrequency - a.winFrequency)

    visibleTournament = Tournament.simulateMostProbable(teams)
    visibleTournament.draw()

    updateSimulationResultsChart(summary)
    updateProbabilityGrid(summary)
}

function runSimulations(numSimulations=10000) {
    for (let i = 0; i < numSimulations; i++) {
        const tournament = Tournament.simulateMonteCarlo(teams)

        if (i + 1 === numSimulations) {
            visibleTournament = tournament
        }
    }

    visibleTournament.draw()
}

async function main() {
    await loadFixedGameOutcomes()
    initStrengthSliders()
    elements.resetStrengthsButton?.addEventListener("click", resetStrengths)
    initFixedGameOutcomesControl()
    initSimulationResultsChartResize()
    updateVisibleTournament()
    recomputeAnalysis()
}

main()
