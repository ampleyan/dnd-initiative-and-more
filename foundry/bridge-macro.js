/**
 * Foundry VTT to Initiative Tracker Bridge
 * 
 * Actions:
 * 1. Extracts location code (e.g., "M7") from Scene Name.
 * 2. Stops all currently playing playlists/music.
 * 3. Opens the Initiative Tracker to the EXACT encounter for that location.
 * 
 * Instructions:
 * - Create a new "Script" macro in Foundry.
 * - Paste this code.
 * - Update TRACKER_URL if your app runs on a different port/address.
 */

const TRACKER_URL = "http://localhost:3000";

async function launchTracker() {
    // 1. Determine location from Scene
    let location = "";
    const sceneName = canvas.scene.name;
    
    // Pattern: Look for codes like M7, P1, 4.01 etc at the start or in brackets
    const match = sceneName.match(/^([A-Z]\d+)|(?:\(([A-Z]\d+)\))/i) || sceneName.match(/([A-Z]\d+)/i);
    if (match) {
        location = (match[1] || match[2] || match[0]).toUpperCase();
    }

    // fallback: ask user if no match found
    if (!location) {
        location = await new Promise(resolve => {
            new Dialog({
                title: "Launch Tracker",
                content: `
                    <div class="form-group">
                        <label>Location Code (e.g. M7):</label>
                        <input type="text" id="loc-code" placeholder="M7">
                    </div>
                `,
                buttons: {
                    go: {
                        label: "Launch",
                        callback: (html) => resolve(html.find("#loc-code").val())
                    },
                    cancel: {
                        label: "Cancel",
                        callback: () => resolve(null)
                    }
                },
                default: "go"
            }).render(true);
        });
    }

    if (!location) return;

    // 2. Stop all playlists
    if (game.playlists) {
        game.playlists.playing.forEach(p => p.stopAll());
    }

    // 3. Find Encounter ID by name/folder
    try {
        const response = await fetch(`${TRACKER_URL}/api/encounters/find-by-name/${encodeURIComponent(location)}`);
        if (response.ok) {
            const data = await response.json();
            if (data.id) {
                window.open(`${TRACKER_URL}/encounters/${data.id}`, '_blank');
                ui.notifications.info(`Initiative Tracker launched for ${location}`);
                return;
            }
        }
    } catch (e) {
        console.error("Tracker Bridge Error:", e);
    }

    // Fallback: Open general tracker with search
    window.open(`${TRACKER_URL}/encounters?search=${encodeURIComponent(location)}`, '_blank');
    ui.notifications.warn(`Encounter for ${location} not found. Opened tracker search.`);
}

launchTracker();
