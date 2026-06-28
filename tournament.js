const elements = {
    strengthSliders: document.getElementById("strength-sliders"),
    tournamentSvg: document.getElementById("simulated-tournament-svg"),
    simulationResultsChart: document.getElementById("simulation-results-chart"),
    probabilityGrid: document.getElementById("probability-grid"),
    resetStrengthsButton: document.getElementById("reset-strengths-button"),
    fixedGamesControl: document.getElementById("fixed-games-control"),
    applyFixedGameOutcomesCheckbox: document.getElementById("apply-fixed-game-outcomes-checkbox")
}

const MatchupWinner = {
    TeamA: 0,
    TeamB: 1
}

class Tournament {

    static applyFixedGameOutcomes = false

    constructor(teams, matchupMap, rounds, thirdPlaceMatch, placementMap) {
        this.teams = teams

        // Map `${teamA.name}:${teamB.name}`: MatchupWinner
        this.matchupMap = matchupMap
        this.rounds = rounds
        this.thirdPlaceMatch = thirdPlaceMatch
        this.placementMap = placementMap
    }

    getMatchup(teamA, teamB) {
        const key1 = `${teamA.name}:${teamB.name}`
        const key2 = `${teamB.name}:${teamA.name}`

        if (this.matchupMap.has(key1)) {
            return this.matchupMap.get(key1)
        } else {
            return this.matchupMap.get(key2)
        }
    }

    static simulateMonteCarlo(teams) {
        return Tournament.simulate(teams, false)
    }

    static simulateMostProbable(teams) {
        const leftHalfStates = Tournament.getMostProbableSubtreeStates(teams, 0, 16)
        const rightHalfStates = Tournament.getMostProbableSubtreeStates(teams, 16, 16)
        let bestTournament = null

        for (const leftState of leftHalfStates.values()) {
            for (const rightState of rightHalfStates.values()) {
                const teamA = leftState.winnerTeam
                const teamB = rightState.winnerTeam
                const teamAWinProbability = Tournament.getWinProbability(teamA, teamB)
                const thirdPlaceMatch = Tournament.simulateMostProbableMatch(
                    leftState.semifinalLoserTeam,
                    rightState.semifinalLoserTeam
                )
                const thirdPlaceWinProbability = thirdPlaceMatch.winner === MatchupWinner.TeamA
                    ? Tournament.getWinProbability(thirdPlaceMatch.teamA, thirdPlaceMatch.teamB)
                    : Tournament.getWinProbability(thirdPlaceMatch.teamB, thirdPlaceMatch.teamA)

                const possibleFinals = [
                    {
                        probability: teamAWinProbability,
                        matchup: { teamA, teamB, winner: MatchupWinner.TeamA, winnerTeam: teamA }
                    },
                    {
                        probability: 1 - teamAWinProbability,
                        matchup: { teamA, teamB, winner: MatchupWinner.TeamB, winnerTeam: teamB }
                    }
                ]

                for (const finalResult of possibleFinals) {
                    const probability = leftState.probability
                        * rightState.probability
                        * finalResult.probability
                        * thirdPlaceWinProbability

                    if (bestTournament && probability <= bestTournament.probability) {
                        continue
                    }

                    const rounds = Tournament.mergeRounds(
                        leftState.rounds,
                        rightState.rounds,
                        4,
                        finalResult.matchup
                    )

                    bestTournament = {
                        probability,
                        rounds,
                        thirdPlaceMatch
                    }
                }
            }
        }

        const matchupMap = Tournament.buildMatchupMap(bestTournament.rounds, bestTournament.thirdPlaceMatch)
        const placementMap = Tournament.buildPlacementMap(bestTournament.rounds, bestTournament.thirdPlaceMatch)

        return new Tournament(teams, matchupMap, bestTournament.rounds, bestTournament.thirdPlaceMatch, placementMap)
    }

    static simulateGreedy(teams) {
        return Tournament.simulate(teams, true)
    }

    static simulate(teams, alwaysChooseHigherProbability) {
        let currentTeams = teams
        let newTeamBuffer = []
        const matchups = new Map()
        const rounds = []
        const placementMap = new Map()

        for (let roundI = 0; roundI < 5; roundI++) {
            const roundMatchups = []

            for (let i = 0; i < currentTeams.length; i += 2) {
                const teamA = currentTeams[i]
                const teamB = currentTeams[i + 1]

                const matchup = alwaysChooseHigherProbability
                    ? Tournament.simulateMostProbableMatch(teamA, teamB)
                    : Tournament.simulateMatch(teamA, teamB)

                // console.log(`${teamA.name} vs ${teamB.name}: ${matchup.winnerTeam.name} won.`)
                matchups.set(`${teamA.name}:${teamB.name}`, matchup.winner)
                roundMatchups.push(matchup)
                placementMap.set(Tournament.getLoserTeam(matchup).isoId, {
                    round: 4 - roundI,
                    placement: null
                })

                newTeamBuffer.push(matchup.winnerTeam)
            }

            rounds.push(roundMatchups)
            currentTeams = newTeamBuffer
            newTeamBuffer = []
        }

        const leftSemiLoser = Tournament.getLoserTeam(rounds[3][0])
        const rightSemiLoser = Tournament.getLoserTeam(rounds[3][1])
        const thirdPlaceMatch = alwaysChooseHigherProbability
            ? Tournament.simulateMostProbableMatch(leftSemiLoser, rightSemiLoser)
            : Tournament.simulateMatch(leftSemiLoser, rightSemiLoser)
        matchups.set(`${leftSemiLoser.name}:${rightSemiLoser.name}`, thirdPlaceMatch.winner)

        Tournament.setFinalPlacements(placementMap, rounds, thirdPlaceMatch)

        return new Tournament(teams, matchups, rounds, thirdPlaceMatch, placementMap)
    }

    static getMostProbableSubtreeStates(teams, startIndex, size) {
        if (size === 1) {
            const team = teams[startIndex]

            return new Map([[team.isoId, {
                winnerTeam: team,
                semifinalLoserTeam: null,
                probability: 1,
                rounds: Tournament.createEmptyRounds()
            }]])
        }

        const halfSize = size / 2
        const roundIndex = Math.log2(size) - 1
        const leftStates = Tournament.getMostProbableSubtreeStates(teams, startIndex, halfSize)
        const rightStates = Tournament.getMostProbableSubtreeStates(teams, startIndex + halfSize, halfSize)
        const subtreeStates = new Map()

        for (const leftState of leftStates.values()) {
            for (const rightState of rightStates.values()) {
                const teamA = leftState.winnerTeam
                const teamB = rightState.winnerTeam
                const teamAWinProbability = Tournament.getWinProbability(teamA, teamB)
                const possibleResults = [
                    {
                        probability: teamAWinProbability,
                        matchup: { teamA, teamB, winner: MatchupWinner.TeamA, winnerTeam: teamA },
                        semifinalLoserTeam: size === 16 ? teamB : null
                    },
                    {
                        probability: 1 - teamAWinProbability,
                        matchup: { teamA, teamB, winner: MatchupWinner.TeamB, winnerTeam: teamB },
                        semifinalLoserTeam: size === 16 ? teamA : null
                    }
                ]

                for (const result of possibleResults) {
                    const winnerKey = result.matchup.winnerTeam.isoId
                    const stateKey = size === 16
                        ? `${winnerKey}:${result.semifinalLoserTeam.isoId}`
                        : winnerKey
                    const probability = leftState.probability * rightState.probability * result.probability
                    const previousState = subtreeStates.get(stateKey)

                    if (previousState && previousState.probability >= probability) {
                        continue
                    }

                    subtreeStates.set(stateKey, {
                        winnerTeam: result.matchup.winnerTeam,
                        semifinalLoserTeam: result.semifinalLoserTeam,
                        probability,
                        rounds: Tournament.mergeRounds(leftState.rounds, rightState.rounds, roundIndex, result.matchup)
                    })
                }
            }
        }

        return subtreeStates
    }

    static createEmptyRounds() {
        return Array.from({ length: 5 }, () => [])
    }

    static mergeRounds(leftRounds, rightRounds, roundIndex, matchup) {
        return leftRounds.map((round, i) => {
            const mergedRound = [...round, ...rightRounds[i]]

            if (i === roundIndex) {
                mergedRound.push(matchup)
            }

            return mergedRound
        })
    }

    static buildMatchupMap(rounds, thirdPlaceMatch) {
        const matchupMap = new Map()

        for (const round of rounds) {
            for (const matchup of round) {
                matchupMap.set(`${matchup.teamA.name}:${matchup.teamB.name}`, matchup.winner)
            }
        }

        matchupMap.set(`${thirdPlaceMatch.teamA.name}:${thirdPlaceMatch.teamB.name}`, thirdPlaceMatch.winner)

        return matchupMap
    }

    static buildPlacementMap(rounds, thirdPlaceMatch) {
        const placementMap = new Map()

        for (let roundI = 0; roundI < rounds.length; roundI++) {
            for (const matchup of rounds[roundI]) {
                placementMap.set(Tournament.getLoserTeam(matchup).isoId, {
                    round: 4 - roundI,
                    placement: null
                })
            }
        }

        Tournament.setFinalPlacements(placementMap, rounds, thirdPlaceMatch)

        return placementMap
    }

    static setFinalPlacements(placementMap, rounds, thirdPlaceMatch) {
        placementMap.set(rounds[4][0].winnerTeam.isoId, {
            round: 0,
            placement: 1
        })
        placementMap.set(Tournament.getLoserTeam(rounds[4][0]).isoId, {
            round: 0,
            placement: 2
        })
        placementMap.set(thirdPlaceMatch.winnerTeam.isoId, {
            round: 1,
            placement: 3
        })
    }

    static simulateMatch(teamA, teamB) {
        const winProbability = Tournament.getWinProbability(teamA, teamB)
        const teamAwins = Math.random() < winProbability
        const winner = teamAwins ? MatchupWinner.TeamA : MatchupWinner.TeamB
        const winnerTeam = teamAwins ? teamA : teamB

        return { teamA, teamB, winner, winnerTeam }
    }

    static simulateMostProbableMatch(teamA, teamB) {
        const teamAwins = Tournament.getWinProbability(teamA, teamB) >= 0.5
        const winner = teamAwins ? MatchupWinner.TeamA : MatchupWinner.TeamB
        const winnerTeam = teamAwins ? teamA : teamB

        return { teamA, teamB, winner, winnerTeam }
    }

    static getWinProbability(teamA, teamB) {
        const fixedWinnerIsoId = Tournament.getFixedWinnerIsoId(teamA, teamB)

        if (fixedWinnerIsoId === teamA.isoId) {
            return 1
        }

        if (fixedWinnerIsoId === teamB.isoId) {
            return 0
        }

        return teamA.strength / (teamA.strength + teamB.strength)
    }

    static getFixedWinnerIsoId(teamA, teamB) {
        if (!Tournament.applyFixedGameOutcomes
            || typeof FIXED_GAME_OUTCOMES === "undefined"
            || !Array.isArray(FIXED_GAME_OUTCOMES)) {
            return null
        }

        for (const [winnerIsoId, loserIsoId] of FIXED_GAME_OUTCOMES) {
            const teamsMatch = (teamA.isoId === winnerIsoId && teamB.isoId === loserIsoId)
                || (teamA.isoId === loserIsoId && teamB.isoId === winnerIsoId)

            if (teamsMatch) {
                return winnerIsoId
            }
        }

        return null
    }

    static isFixedMatchupWinner(matchup) {
        return Tournament.getFixedWinnerIsoId(matchup.teamA, matchup.teamB) === matchup.winnerTeam.isoId
    }

    static getLoserTeam(matchup) {
        return matchup.winner === MatchupWinner.TeamA ? matchup.teamB : matchup.teamA
    }

    draw(svg=null) {
        svg ??= elements.tournamentSvg
        const drawer = new TournamentDrawer(svg, this)
        drawer.draw()
    }

}

class TournamentDrawer {

    constructor(svg, tournament) {
        this.svg = svg
        this.tournament = tournament
        this.svgNamespace = "http://www.w3.org/2000/svg"
        this.width = 1200
        this.height = 760
        this.flagWidth = 34 * 1.5
        this.flagHeight = 24 * 1.5
        this.lineColor = "black"
        this.lineWidth = 2
        this.sidePadding = 45
        this.centerX = this.width / 2
        this.topPadding = 38
        this.bottomPadding = 38
        this.leftRoundX = [45, 180, 315, 450, 555]
        this.rightRoundX = [1155, 1020, 885, 750, 645]
        this.flagSources = new Map(tournament.teams.map(team => [team, team.getFlagSource()]))
    }

    draw() {
        this.clear()
        this.svg.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`)

        const leftNodes = this.buildSideNodes(0, this.leftRoundX)
        const rightNodes = this.buildSideNodes(16, this.rightRoundX)
        const finalMatch = this.tournament.rounds[4][0]
        const champion = finalMatch.winnerTeam
        const finalNode = { x: this.centerX, y: this.height / 2 }
        const championNode = {
            team: champion,
            x: this.centerX,
            y: this.height / 2 - 70,
            fixedWin: Tournament.isFixedMatchupWinner(finalMatch)
        }
        const thirdPlaceNode = { x: this.centerX, y: this.height / 2 + 70 }
        const thirdPlaceWinnerNode = {
            team: this.tournament.thirdPlaceMatch.winnerTeam,
            x: this.centerX,
            y: this.height / 2 + 140,
            fixedWin: Tournament.isFixedMatchupWinner(this.tournament.thirdPlaceMatch)
        }
        const thirdPlaceTeamANode = {
            team: this.tournament.thirdPlaceMatch.teamA,
            x: this.leftRoundX[4],
            y: thirdPlaceNode.y
        }
        const thirdPlaceTeamBNode = {
            team: this.tournament.thirdPlaceMatch.teamB,
            x: this.rightRoundX[4],
            y: thirdPlaceNode.y
        }

        this.drawSideLines(leftNodes)
        this.drawSideLines(rightNodes)
        this.drawLine(leftNodes[4][0], finalNode)
        this.drawLine(rightNodes[4][0], finalNode)
        this.drawLine(finalNode, championNode)
        this.drawLine(thirdPlaceTeamANode, thirdPlaceNode)
        this.drawLine(thirdPlaceTeamBNode, thirdPlaceNode)
        this.drawLine(thirdPlaceNode, thirdPlaceWinnerNode)
        this.drawNodes(leftNodes)
        this.drawNodes(rightNodes)
        this.drawFlag(championNode)
        this.drawFlag(thirdPlaceTeamANode)
        this.drawFlag(thirdPlaceTeamBNode)
        this.drawFlag(thirdPlaceWinnerNode)
    }

    clear() {
        this.svg.replaceChildren()
    }

    buildSideNodes(teamOffset, roundX) {
        const nodes = [
            this.tournament.teams.slice(teamOffset, teamOffset + 16).map((team, i) => {
                return {
                    team,
                    x: roundX[0],
                    y: this.getInitialY(i)
                }
            })
        ]

        for (let roundI = 0; roundI < 4; roundI++) {
            const winnersInSide = 8 / Math.pow(2, roundI)
            const round = this.tournament.rounds[roundI]
            const matchupOffset = teamOffset === 0 ? 0 : winnersInSide
            const roundNodes = []

            for (let i = 0; i < winnersInSide; i++) {
                const previousA = nodes[roundI][i * 2]
                const previousB = nodes[roundI][i * 2 + 1]
                const matchup = round[matchupOffset + i]

                roundNodes.push({
                    team: matchup.winnerTeam,
                    x: roundX[roundI + 1],
                    y: (previousA.y + previousB.y) / 2,
                    fixedWin: Tournament.isFixedMatchupWinner(matchup)
                })
            }

            nodes.push(roundNodes)
        }

        return nodes
    }

    getInitialY(i) {
        const usableHeight = this.height - this.topPadding - this.bottomPadding
        return this.topPadding + (usableHeight * i) / 15
    }

    drawSideLines(nodes) {
        for (let roundI = 1; roundI < nodes.length; roundI++) {
            for (let i = 0; i < nodes[roundI].length; i++) {
                const node = nodes[roundI][i]
                const previousA = nodes[roundI - 1][i * 2]
                const previousB = nodes[roundI - 1][i * 2 + 1]

                this.drawBracketLine(previousA, previousB, node)
            }
        }
    }

    drawBracketLine(previousA, previousB, node) {
        const elbowX = (previousA.x + node.x) / 2
        const path = this.createSvgElement("path")
        path.setAttribute("d", [
            `M ${previousA.x} ${previousA.y}`,
            `H ${elbowX}`,
            `V ${previousB.y}`,
            `H ${previousB.x}`,
            `M ${elbowX} ${node.y}`,
            `H ${node.x}`
        ].join(" "))
        path.setAttribute("fill", "none")
        path.setAttribute("stroke", this.lineColor)
        path.setAttribute("stroke-width", this.lineWidth)
        this.svg.appendChild(path)
    }

    drawLine(from, to) {
        const line = this.createSvgElement("line")
        line.setAttribute("x1", from.x)
        line.setAttribute("y1", from.y)
        line.setAttribute("x2", to.x)
        line.setAttribute("y2", to.y)
        line.setAttribute("stroke", this.lineColor)
        line.setAttribute("stroke-width", this.lineWidth)
        this.svg.appendChild(line)
    }

    drawNodes(nodes) {
        for (const roundNodes of nodes) {
            for (const node of roundNodes) {
                this.drawFlag(node)
            }
        }
    }

    drawFlag(node) {
        const group = this.createSvgElement("g")
        const x = node.x - this.flagWidth / 2
        const y = node.y - this.flagHeight / 2

        group.style.cursor = "pointer"
        group.addEventListener("click", () => {
            if (window.scrollToProbabilityCard) {
                window.scrollToProbabilityCard(node.team.isoId)
            }
        })

        if (node.fixedWin) {
            const box = this.createSvgElement("rect")
            box.setAttribute("x", x - 4)
            box.setAttribute("y", y - 4)
            box.setAttribute("width", this.flagWidth + 8)
            box.setAttribute("height", this.flagHeight + 8)
            box.setAttribute("fill", "none")
            box.setAttribute("stroke", "black")
            box.setAttribute("stroke-width", 3)
            group.appendChild(box)
        }

        const image = this.createSvgElement("image")
        image.setAttribute("href", this.flagSources.get(node.team))
        image.setAttribute("data-team-id", node.team.isoId)
        image.setAttribute("x", x)
        image.setAttribute("y", y)
        image.setAttribute("width", this.flagWidth)
        image.setAttribute("height", this.flagHeight)
        image.setAttribute("preserveAspectRatio", "xMidYMid meet")
        group.appendChild(image)
        this.svg.appendChild(group)
    }

    createSvgElement(tagName) {
        return document.createElementNS(this.svgNamespace, tagName)
    }

}

let visibleTournament = null

function updateVisibleTournament() {
    visibleTournament = Tournament.simulateMonteCarlo(teams)
    visibleTournament.draw()
}
