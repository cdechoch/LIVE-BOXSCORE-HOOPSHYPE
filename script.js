// HoopScores Rotator 3000 - Main Application Script
class BoxscoreRotator {
    constructor() {
        this.games = [];
        this.currentGameIndex = 0;
        this.rotationInterval = null;
        this.isRotating = true;
        this.lastFetchDate = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadTodayGames();
    }

    initializeElements() {
        this.boxscoreContainer = document.getElementById('boxscore-container');
        this.currentGameNumber = document.getElementById('current-game-number');
        this.totalGames = document.getElementById('total-games');
        this.gameInfo = document.getElementById('game-info');
        this.lastUpdated = document.getElementById('last-updated');
        
        this.prevButton = document.getElementById('prev-game');
        this.nextButton = document.getElementById('next-game');
        this.toggleButton = document.getElementById('toggle-rotation');
    }

    setupEventListeners() {
        this.prevButton.addEventListener('click', () => this.previousGame());
        this.nextButton.addEventListener('click', () => this.nextGame());
        this.toggleButton.addEventListener('click', () => this.toggleRotation());
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.previousGame();
            if (e.key === 'ArrowRight') this.nextGame();
            if (e.key === ' ') {
                e.preventDefault();
                this.toggleRotation();
            }
        });
    }

    async loadTodayGames() {
        try {
            const today = this.getTodayDateEST();
            this.lastFetchDate = today;
            
            // Using ESPN API with CORS proxy
            const scoreboardUrl = `https://corsproxy.io/?https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${today}`;
            
            const response = await fetch(scoreboardUrl);
            const data = await response.json();
            
            // Filter for live and completed games from today
            this.games = (data.events || []).filter(event => {
                const status = event.status?.type?.state;
                return status === 'post' || status === 'in'; // Finished or live games
            });
            
            this.updateGameCount();
            
            if (this.games.length > 0) {
                this.displayCurrentGame();
                this.startRotation();
                this.startAutoRefresh();
            } else {
                this.showNoGamesMessage();
            }
            
            this.updateLastUpdatedTime();
        } catch (error) {
            console.error('Error loading games:', error);
            this.showErrorMessage('Failed to load boxscores. Please try again later.');
        }
    }

    getTodayDateEST() {
        const now = new Date();
        const estOffset = -5 * 60; // EST is UTC-5
        const estTime = new Date(now.getTime() + (estOffset + now.getTimezoneOffset()) * 60000);
        
        // Format as YYYYMMDD
        const year = estTime.getFullYear();
        const month = String(estTime.getMonth() + 1).padStart(2, '0');
        const day = String(estTime.getDate()).padStart(2, '0');
        
        return `${year}${month}${day}`;
    }

    async displayCurrentGame() {
        if (this.games.length === 0) return;
        
        const game = this.games[this.currentGameIndex];
        this.boxscoreContainer.innerHTML = this.createLoadingHTML();
        
        try {
            const boxscoreData = await this.fetchBoxscore(game.id);
            if (boxscoreData) {
                this.renderBoxscore(boxscoreData, game);
            }
        } catch (error) {
            console.error('Error displaying game:', error);
            this.showErrorMessage('Failed to load boxscore for this game.');
        }
    }

    async fetchBoxscore(gameId) {
        const boxscoreUrl = `https://corsproxy.io/?https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`;
        
        const response = await fetch(boxscoreUrl);
        return await response.json();
    }

    renderBoxscore(boxscoreData, game) {
        const competition = game.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
        
        const playersByTeam = boxscoreData.boxscore?.players || [];
        const homePlayers = playersByTeam.find(p => p.team.id === homeTeam.team.id);
        const awayPlayers = playersByTeam.find(p => p.team.id === awayTeam.team.id);
        
        const isLive = game.status?.type?.state === 'in';
        const statusText = isLive ? 'LIVE' : 'FINAL';
        const bgGradient = isLive ? 'from-red-600 to-orange-600' : 'from-blue-600 to-purple-600';
        const statusClass = isLive ? 'game-status-live' : 'game-status-final';
        
        const html = `
            <div class="boxscore-fade-in">
                <!-- Game Header -->
                <div class="team-header bg-gradient-to-r ${bgGradient} ${statusClass}">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                        <div class="flex items-center justify-center space-x-4">
                            <img src="${awayTeam.team.logo}" alt="${awayTeam.team.displayName}" class="w-16 h-16 bg-white rounded-lg p-2 team-logo">
                            <div class="text-center">
                                <div class="font-bold text-xl">${awayTeam.team.abbreviation}</div>
                                <div class="text-5xl font-bold mt-1">${awayTeam.score || 0}</div>
                            </div>
                        </div>
                        <div class="flex flex-col items-center justify-center">
                            <div class="text-xl font-bold uppercase tracking-wide ${isLive ? 'live-indicator' : ''}">${statusText}</div>
                            <div class="text-sm mt-2 opacity-90">${game.status?.type?.detail || ''}</div>
                            ${isLive ? '<div class="mt-2 flex items-center gap-2"><span class="w-3 h-3 bg-red-500 rounded-full live-indicator"></span></div>' : ''}
                        </div>
                        <div class="flex items-center justify-center space-x-4">
                            <div class="text-center">
                                <div class="font-bold text-xl">${homeTeam.team.abbreviation}</div>
                                <div class="text-5xl font-bold mt-1">${homeTeam.score || 0}</div>
                            </div>
                            <img src="${homeTeam.team.logo}" alt="${homeTeam.team.displayName}" class="w-16 h-16 bg-white rounded-lg p-2 team-logo">
                        </div>
                    </div>
                </div>

                <!-- Player Stats -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    ${this.renderTeamStats(awayPlayers, awayTeam.team.displayName)}
                    ${this.renderTeamStats(homePlayers, homeTeam.team.displayName)}
                </div>
            </div>
        `;
        
        this.boxscoreContainer.innerHTML = html;
        this.updateGameInfo(game, homeTeam, awayTeam);
    }

    renderTeamStats(teamData, teamName) {
        if (!teamData || !teamData.statistics || teamData.statistics.length === 0) {
            return `
                <div class="bg-white rounded-lg shadow-lg p-6 hover-lift">
                    <h3 class="text-lg font-semibold mb-4 text-gray-800">${teamName}</h3>
                    <p class="text-gray-500 text-center py-8">No player data available</p>
                </div>
            `;
        }
        
        const stats = teamData.statistics[0];
        const headers = stats.labels || [];
        const athletes = stats.athletes || [];
        // Filter out OREB and DREB headers and stats
        const rebIndex = headers.findIndex(header => header === 'REB');
        const orebIndex = headers.findIndex(header => header === 'OREB');
        const drebIndex = headers.findIndex(header => header === 'DREB');
        
        // Create new headers and stats arrays without OREB and DREB
        const filteredHeaders = headers.filter(h => h !== 'OREB' && h !== 'DREB');
        
        const filteredAthletes = athletes.map(athlete => {
            const filteredStats = athlete.stats.filter((stat, index) => {
                return headers[index] !== 'OREB' && headers[index] !== 'DREB';
            });
            return { ...athlete, stats: filteredStats };
        });
return `
            <div class="bg-white rounded-lg shadow-lg p-6 hover-lift">
                <h3 class="text-lg font-semibold mb-4 text-gray-800">${teamName}</h3>
                <div class="overflow-x-auto">
                    <table class="stats-table w-full">
                        <thead>
                            <tr>
                                <th class="text-left pr-4">Player</th>
                                ${filteredHeaders.map(header => `<th class="text-right px-2">${header}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredAthletes.map(athlete => `
                                <tr class="hover:bg-gray-50 transition-colors">
                                    <td class="font-medium text-left pr-4">${athlete.athlete.displayName}</td>
                                    ${athlete.stats.map(stat => `<td class="text-right px-2">${stat}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    updateGameInfo(game, homeTeam, awayTeam) {
        const venue = game.competitions[0]?.venue?.fullName || 'NBA Arena';
        const date = new Date(game.date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        this.gameInfo.innerHTML = `
            <h2 class="text-xl font-bold text-gray-800">${awayTeam.team.displayName} @ ${homeTeam.team.displayName}</h2>
            <p class="text-gray-600">${venue} • ${date}</p>
        `;
    }

    nextGame() {
        this.currentGameIndex = (this.currentGameIndex + 1) % this.games.length;
        this.displayCurrentGame();
        this.updateGameCount();
    }

    previousGame() {
        this.currentGameIndex = this.currentGameIndex === 0 ? this.games.length - 1 : this.currentGameIndex - 1;
        this.displayCurrentGame();
        this.updateGameCount();
    }

    startRotation() {
        if (this.rotationInterval) {
            clearInterval(this.rotationInterval);
        }
        
        this.rotationInterval = setInterval(() => {
            if (this.isRotating) {
                this.nextGame();
            }
        }, 15000); // 15 seconds
    }

    startAutoRefresh() {
        setInterval(() => {
            this.loadTodayGames();
        }, 30000); // Refresh every 30 seconds
    }

    toggleRotation() {
        this.isRotating = !this.isRotating;
        
        const icon = this.isRotating ? 'pause' : 'play';
        const text = this.isRotating ? 'Pause' : 'Resume';
        
        this.toggleButton.innerHTML = `
            <i data-feather="${icon}" class="w-5 h-5"></i>
            <span class="hidden sm:inline">${text}</span>
        `;
        
        // Add button class for animation
        this.toggleButton.classList.add('btn-primary');
        feather.replace();
    }

    updateGameCount() {
        this.currentGameNumber.textContent = this.currentGameIndex + 1;
        this.totalGames.textContent = this.games.length;
    }

    updateLastUpdatedTime() {
        const now = new Date();
        this.lastUpdated.textContent = now.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            dateStyle: 'medium',
            timeStyle: 'medium'
        });
    }

    createLoadingHTML() {
        return `
            <div class="text-center py-12">
                <div class="spinner mx-auto"></div>
                <p class="mt-4 text-gray-500">Loading boxscore data...</p>
            </div>
        `;
    }

    showNoGamesMessage() {
        this.boxscoreContainer.innerHTML = `
            <div class="text-center py-16 bg-white rounded-xl shadow-lg">
                <i data-feather="calendar" class="w-16 h-16 text-gray-400 mx-auto"></i>
                <h3 class="text-xl font-semibold text-gray-600 mt-4">No Games Today</h3>
                <p class="text-gray-500 mt-2">There are no NBA games in progress or completed today.</p>
            </div>
        `;
        feather.replace();
    }

    showErrorMessage(message) {
        this.boxscoreContainer.innerHTML = `
            <div class="text-center py-16 bg-white rounded-xl shadow-lg">
                <i data-feather="alert-triangle" class="w-16 h-16 text-red-400 mx-auto"></i>
                <h3 class="text-xl font-semibold text-gray-600 mt-4">Unable to Load Data</h3>
                <p class="text-gray-500 mt-2">${message}</p>
                <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                    Retry
                </button>
            </div>
        `;
        feather.replace();
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.boxscoreRotator = new BoxscoreRotator();
    feather.replace();
});