const moduleId = 'quick-compendiums';

function getControlButtons(controls) {
	controls.tokens.tools['QuickCompendiums'] = {
		name: "QuickCompendiums",
		title: `Compendiums`,
		icon: "fas fa-book",
		visible: true,
		onClick: () => {
			selectCompendium();
		},
		button: true
	};
}

Hooks.on('getSceneControlButtons', (controls) => getControlButtons(controls));

function setClickHandlers(dialog) {
	const compendiums = dialog.element.querySelectorAll('.compendium');
	
	for (const elt of compendiums) {
		
		// Left click handler -- open selected compendium.

		elt.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopImmediatePropagation();
			const packId = e.currentTarget.getAttribute('data-packid');
			const pack = game.packs.get(packId);

			if (pack) {
				pack.render(true);
			}
			dialog.close();
		});
		
		// Right-click handler -- delete selected compendium.

		elt.addEventListener("contextmenu", async (e) => {
			e.preventDefault();
			e.stopImmediatePropagation();
			const packId = e.currentTarget.getAttribute('data-packid');
			const index = dialog.packIds.findIndex((e) => e.id == packId);
			if (index < 0)
				return ui.notifications.error(`Compendium ${packId} not found in list.`);
			dialog.packIds.splice(index, 1);
			updateCompendiumList(dialog);
		});
	}
}

function updateCompendiumList(dialog) {
	const div = dialog.element.querySelector(".complist");
	if (!div)
		return ui.notifications.notify('Unable to update compendium list: missing div');
	const choices = getChoiceHTML(dialog.packIds);
	div.innerHTML = choices;
	setClickHandlers(dialog);
}

class CompendiumsDialog extends foundry.applications.api.DialogV2 {
	packIds = null;

    async _onRender(context, options) {
		await super._onRender(context, options);
		
		setClickHandlers(this);

		// Drag and drop handler -- add the compendium to the list of compendiums.

		async function onDrop(event) {
            const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);

			if (!this?.element) {
				console.warn("Dialog has no rendered element yet.");
				return;
			}
			if (data.type != 'Compendium')
				return ui.notifications.notify(`Drop a collection on the dialog. This was a ${data.type}.`);
			if (this.packIds.find((e) => e.id == data.collection))
				return ui.notifications.notify(`Already listed: ${data.collection}`);
			this.packIds.push({id: data.collection, display: null});
			updateCompendiumList(this);
		}

		if (game.user.isGM) {
			// Drop macro
			const dnd = new foundry.applications.ux.DragDrop.implementation({
				dragSelector: null,
				dropSelector: null,
				permissions: {
					dragstart: false,
					drop: true,
				},
				callbacks: {
					drop: onDrop.bind(this)
				}		  

			});
			dnd.bind(this.element);
		}
	}	 

	constructor(args, packIds) {
		super(args);
		this.packIds = packIds;
	}
}


function getChoiceHTML(packIds) {
	const packs = packIds.map(p => game.packs.get(p.id));

	if (!packs.length)
		return "";

	let list = "";

	const cellsPerRow = Math.floor(Math.sqrt(packIds.length));

	let cells = 0;
	let names = [];

	for (let i = 0; i < packs.length; i++) {
		const pack =  packs[i];
		if (cells++ == 0)
			list += `<div style="display: table-row;">`;
		let name = packIds[i].display ? packIds[i].display : pack.metadata.label;
		if (names.includes(name)) {
			let [module, uuid] = pack.metadata.id.split('.');
			name += ` (${module})`;
		}
		names.push(name);
		list += `<div class="compendium" style="display: table-cell; padding-right: 10px;" data-packid="${pack.collection}">${name}</div>`;
		if (cells >= cellsPerRow) {
			cells = 0;
			list += `</div>`;
		}
	}
	if (cells > 0)
		list += `</div>`;
	return list;
/*
	return packs.map(pack => {
		return `<p class="compendium" data-packid="${pack.collection}">${pack.metadata.label}</p>`;
	}).join("");
*/
}


function selectCompendium() {
	function saveCompendiumList(packIds) {
		let compList = "";
		for (const p of packIds) {
			if (compList)
				compList += ',';
			if (p.display)
				compList += `${p.id}[${p.display}]`;
			else
				compList += p.id;
		}
		game.settings.set(moduleId, 'compendiums', compList);
	}

	const setting = game.settings.get(moduleId, "compendiums");

	let packIds = [];
	let entries = setting.split(/ *, */);
	for (const entry of entries) {
		const m = entry.match(/^([^\[]+)(\[(.+)\])*$/);
		let packInfo = {id: '', display: ''};
		if (m && m[3]) {
			packInfo.id = m[1];
			packInfo.display = m[3];
		} else {
			packInfo.id = entry;
			packInfo.display = null;
		}
		packIds.push(packInfo);
	}

	let choices = getChoiceHTML(packIds);

	let content = `<form>`;
	if (game.user.isGM)
		content += `<p>Drag and drop compendiums in the dialog.<br>Right-click an entry to remove it.</p>`;
	content +=  `<div style="display: table;">
		<div class="complist" style="display: table-row-group">
		  ${choices}
		</div>
	  </div>
	</form>`;

	let buttons = [];
	if (game.user.isGM) {
		buttons.push({
			action: "save",
			label: "Save",
			callback: async (event, button, dialog) => {
				await saveCompendiumList(packIds);
			}
		});
	}

	buttons.push({
		action: "cancel",
		label: "Cancel"
	});
	const dialog = new CompendiumsDialog({
		window: {
			title: "Open Compendium"
		},
		content,
		buttons: buttons
	}, packIds);

	dialog.render(true);
}

Hooks.once('init', async function () {
	game.settings.register(moduleId, 'compendiums', {
	  name: 'Compendium List',
	  hint: 'Comma-delimited list of compendiums that are listed in the Compendiums button.',
	  scope: 'world',     // "world" = sync to db, "client" = local storage
	  config: true,       // false if you dont want it to show in module config
	  type: String,       // Number, Boolean, String, Object
	  default: "",
	  onChange: value => { // value is the new value of the setting
		//console.log('swade-charcheck | budget: ' + value)
	  }
	});
});