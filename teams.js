class FootballTeam {

    constructor(name, strength=1, isoId=null) {
        this.name = name
        this.strength = strength
        this.isoId = isoId ?? (["switzerland", "germany", "france"][Math.floor(Math.random() * 3)])
    }

    getFlagSource() {
        return `assets/flags/${this.isoId}.svg`
    }

    getShowString() {
        return `str(${this.name})=$${this.strength.toFixed(1)}$`
    }

}

// const allTeamNames = {
//     "algeria": "Algeria",
//     "argentina": "Argentina",
//     "australia": "Australia",
//     "austria": "Austria",
//     "belgium": "Belgium",
//     "bosnia_and_herzegovina": "Bosnia and Herzegovina",
//     "brazil": "Brazil",
//     "canada": "Canada",
//     "cape_verde": "Cape Verde",
//     "colombia": "Colombia",
//     "croatia": "Croatia",
//     "dr_congo": "D. R. Congo",
//     "ecuador": "Ecuador",
//     "egypt": "Egypt",
//     "england": "England",
//     "france": "France",
//     "germany": "Germany",
//     "ghana": "Ghana",
//     "iran": "Iran",
//     "ivory_coast": "Ivory Coast",
//     "japan": "Japan",
//     "jordan": "Jordan",
//     "mexico": "Mexico",
//     "morocco": "Morocco",
//     "netherlands": "Netherlands",
//     "norway": "Norway",
//     "panama": "Panama",
//     "paraguay": "Paraguay",
//     "portugal": "Portugal",
//     "scotland": "Scotland",
//     "senegal": "Senegal",
//     "south_africa": "South Africa",
//     "south_korea": "South Korea",
//     "spain": "Spain",
//     "sweden": "Sweden",
//     "switzerland": "Switzerland",
//     "united_states": "United States",
//     "uzbekistan": "Uzbekistan",
// }

// const teams = Array.from({ length: 32 }, (_, i) => {
//     const [isoId, name] = Object.entries(allTeamNames)[i]
//     const score = Math.floor(Math.random() * 50) / 10 + 0.1
//     return new FootballTeam(name, name === "Germany" ? 10 : score, isoId)
// })

const teams = [
    new FootballTeam("Germany", 8.6, "germany"),
    new FootballTeam("Paraguay", 3.6, "paraguay"),
    new FootballTeam("France", 10.0, "france"),
    new FootballTeam("Sweden", 3.7, "sweden"),
    new FootballTeam("South Africa", 4.0, "south_africa"),
    new FootballTeam("Canada", 4.8, "canada"),
    new FootballTeam("Netherlands", 8.8, "netherlands"),
    new FootballTeam("Morocco", 8.4, "morocco"),
    new FootballTeam("Portugal", 8.7, "portugal"),
    new FootballTeam("Croatia", 7.5, "croatia"),
    new FootballTeam("Spain", 9.7, "spain"),
    new FootballTeam("Austria", 5.0, "austria"),
    new FootballTeam("United States", 7.0, "united_states"),
    new FootballTeam("Bosnia and Herzegovina", 3.7, "bosnia_and_herzegovina"),
    new FootballTeam("Belgium", 8.2, "belgium"),
    new FootballTeam("Senegal", 6.8, "senegal"),
    new FootballTeam("Brazil", 9.1, "brazil"),
    new FootballTeam("Japan", 5.9, "japan"),
    new FootballTeam("Ivory Coast", 5.2, "ivory_coast"),
    new FootballTeam("Norway", 6.4, "norway"),
    new FootballTeam("Mexico", 7.4, "mexico"),
    new FootballTeam("Ecuador", 5.5, "ecuador"),
    new FootballTeam("England", 9.2, "england"),
    new FootballTeam("DR Congo", 3.6, "dr_congo"),
    new FootballTeam("Argentina", 9.8, "argentina"),
    new FootballTeam("Cape Verde", 2.6, "cape_verde"),
    new FootballTeam("Australia", 4.9, "australia"),
    new FootballTeam("Egypt", 4.8, "egypt"),
    new FootballTeam("Switzerland", 6.6, "switzerland"),
    new FootballTeam("Algeria", 5.0, "algeria"),
    new FootballTeam("Colombia", 8.5, "colombia"),
    new FootballTeam("Ghana", 3.6, "ghana"),
]

const FIXED_GAME_OUTCOMES = [
    // format: [teamA.isoId, teamB.isoId], teamA beat teamB in the actual match.
    ["canada", "south_africa"],
    ["brazil", "japan"],
    ["paraguay", "germany"], // :( :( :(
]
