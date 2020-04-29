
/**
* Plugin to format code variable declarations in components.
*/
Draw.loadPlugin(function (ui) {
    var graph = ui.editor.graph;
    var enabled = false;

    var graphViewResetValidationState = graph.view.resetValidationState;

    graph.view.resetValidationState = function () {
        graphViewResetValidationState.apply(this, arguments);
    };

    var graphViewValidateCellState = graph.view.validateCellState;

    graph.view.validateCellState = function (cell, recurse) {
        var state = graphViewValidateCellState.apply(this, arguments);
        recurse = (recurse != null) ? recurse : true;

        if (recurse && state != null && graph.model.isVertex(state.cell) &&
            mxUtils.getValue(state.style, 'styled', 1) == 1) {
            this.redrawNumberShape(state);
        }

        return state;
    };

    function Row(text) {
        this.text = text;
        
        this.varColor = "#aaccff";
        this.funcColor = "#ff99dd";
        this.commentColor = "#009900";
        this.typeColor = "#ffff88";
        this.constantColor = "#ff8866"

        this.addText = function(text) {
            this.text += text;
        }

        this.addColor = function(color, text) {
            return '<font color="' + color + '">' + text + "</font>";
        }

        this.isPartialStartRow = function() {
            return this.text.includes("(") && !this.text.includes(")");
        }

        this.isPartialEndRow = function() {
            return this.text.includes(")") && !this.text.includes("(");
        }

        this.isCodeRow = function() {
            return (
                this.text.includes(":") ||
                this.text.includes("(") ||
                this.text.includes("#")
            )
        }

        this.isFunctionRow = function() {
            if(this.text.includes("(") && !this.text.includes(":"))
                return true;
            if(!this.text.includes("("))
                return false;

            var colPos = this.text.indexOf(":");
            var brackPos = this.text.indexOf("(");
            if(colPos < brackPos)
                return false;
            return true;
        }

        this.isTypeRow = function() {
            return this.text.trim()[0] === this.text.trim()[0].toUpperCase() && this.text.match(/^[a-z]/i);
        }

        this.format = function() {
            if(!this.text.includes("<font") && this.isCodeRow()) {
                if(this.isTypeRow()) {
                    if(this.text.includes(":")) {
                        var parts = this.text.split(":");
                        this.text = this.addColor(this.typeColor, parts[0]) + ":" + this.addColor(this.constantColor, parts[1]);
                    }
                    else {
                        this.text = this.addColor(this.typeColor, this.text);
                    }
                }
                else if(this.text.includes("(")) {
                    var part1 = this.text.split("(");
                    var part2 = part1[1].split(")");
    
                    var part3 = part2[1];
                    part2 = this.addColor(this.varColor, part2[0]);

                    if(this.isFunctionRow()) {
                        part1 = this.addColor(this.funcColor, part1[0]);
                    }
                    else {
                        part1 = this.addColor(this.varColor, part1[0]);
                    }
                        
                    this.text = part1 + "(" + part2 + ")" + part3;
    
                    if(this.text.includes(":")) {
                        var parts = this.text.split(":");
                        this.text = parts[0] + ":" + this.addColor(this.typeColor, parts[1]);
                    }
                }
                else if(this.text.includes(":")) {
                    var parts = this.text.split(":");
                    this.text = this.addColor(this.varColor, parts[0]) + ":" + this.addColor(this.typeColor, parts[1]);
                }

                if(this.text.includes("# ")) {
                    var parts = this.text.split("# ");
                    this.text = parts[0] + this.addColor(this.commentColor, "# " + parts[1]);
                }
            }
        }
    }

    function MultiRowValue(val) {
        this.val = val;
        this.rows = null;
        this.parsedRows = null;

        this.parseRows = function() {
            if(this.rows && !this.parsedRows) {
                this.parsedRows = [];
                var isJoining = false;
                var row = null;
                for(var i in this.rows) {
                    if(!isJoining) {
                        row = new Row(this.rows[i])
                        if(row.isPartialStartRow()) {
                            isJoining = true;
                        }
                        else {
                            this.parsedRows.push(row);
                        }
                    }
                    else if(new Row(this.rows[i]).isPartialEndRow()){
                        row.addText("<br>" + this.rows[i]);
                        this.parsedRows.push(row);
                        isJoining = false;
                    }
                    else {
                        row.addText("<br>" + this.rows[i]);
                    }
                }
            }
        }

        this.renderRows = function() {
            this.parseRows();
            var results = [];
            for(var i in this.parsedRows) {
                var row = this.parsedRows[i];
                row.format();
                results.push(row.text);
            }
            return results.join("<br>");
        }

        this.splitRows = function() {
            this.rows = [];

            if(val.includes("<br>") && val.includes("\n")) {
                var brows = val.split("<br>");
                for(var i in brows) {
                    var nrows = brows[i].split("\n");
                    for(var j in nrows) {
                        this.rows.push(nrows[j])
                    }
                }
            }
            else if(val.includes("<br>")) {
                var brows = val.split("<br>");
                for(var i in brows) {
                    this.rows.push(brows[i]);
                }
            }
            else {
                var nrows = val.split("\n");
                for(var i in nrows) {
                    this.rows.push(nrows[i]);
                }
            }
        }

        this.splitRows();
    }

    graph.view.redrawNumberShape = function (state) {
        if (!state.stylingDone && enabled) {
            state.stylingDone = true;

            if(state.style.shape === "label" && state.cell.parent && state.cell.parent.value) {
                var val = state.cell.value;

                if(val.includes("<br>") || val.includes("\n")) {
                    var rows = new MultiRowValue(val);
                    state.cell.value = rows.renderRows();
                }
                else {
                    var row = new Row(val);
                    row.format();
                    state.cell.value = row.text;
                }

                if(!state.cell.style.includes("html=1")) {
                    state.cell.style += "html=1;"
                }
                state.style.html = 1;
                state.style.styled = true;
            }
        }
    };

    graph.cellRenderer.getShapesForState = function (state) {
        return [state.shape, state.text, state.secondLabel, state.control];
    };

    // Extends View menu
    mxResources.parse('styled=Stylize');

    // Adds action
    var action = ui.actions.addAction('styled...', function () {
        enabled = true;
        graph.refresh();
        enabled = false;

        // Hack to actually refresh the changed formatting to UI
        graph.refresh();
    });

    action.setToggleAction(true);
    action.setSelectedCallback(function () { return enabled; });

    var menu = ui.menus.get('view');
    var oldFunct = menu.funct;

    menu.funct = function (menu, parent) {
        oldFunct.apply(this, arguments);

        ui.menus.addMenuItems(menu, ['-', 'styled'], parent);
    };
});
