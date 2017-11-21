function log_error( msg )
{
    if( console )
        console.log( msg );
}

function mod( a, b )
{
    if( a >= 0 )
        return ( a % b );
    else
    {
        var negMod = ( b + a % b );
        return ( negMod !== b ? negMod : 0 );
    }
}

function Section( type, baseScore )
{
    this.type      = type;
    this.baseScore = baseScore;
    this.score     = baseScore;

    if( type === Section.Type.Double )
        this.score *= 2;
    else if( type === Section.Type.Triple )
        this.score *= 3;

    this.toString = function()
    {
        return this.type + " " + this.baseScore;
    }
}

Section.Type = {
    Miss: "0",
    Inner: "I",
    Outer: "O",
    Double: "D",
    Triple: "T",
    OuterBullseye: "OB",
    InnerBullseye: "IB"
};
if( Object.freeze ) Object.freeze( Section.Type );

function Throw( section, busted )
{
    this.section = section;
    this.busted  = busted;
}

function PlayerRecords( player )
{
    this.onThrowAdded   = null;
    this.onThrowRemoved = null;
    this.onScoreChanged = null;

    this._player    = player;
    this._turns     = [];
    this._score     = 0;
    this._placement = -1;

    this.reset = function()
    {
        this._turns     = [];
        this._score     = 0;
        this._placement = -1;
    }

    this.getPlayerName = function()
    {
        return this._player;
    }

    this.getNumTurns = function()
    {
        return this._turns.length;
    }

    this.addTurn = function()
    {
        this._turns.push( [] );
    }

    this.removeTurn = function( turn )
    {
        var turnIdx = ( turn >= 0 ? turn : this._turns.length + turn );
        this._turns.splice( turnIdx, 1 );
    }

    this.getNumThrows = function( turn )
    {
        return this._turns[ turn >= 0 ? turn : this._turns.length + turn ].length;
    }

    this.getThrow = function( turn, throw_ )
    {
        var turnIdx = ( turn >= 0 ? turn : this._turns.length + turn );
        var throwIdx = ( throw_ >= 0 ? throw_ : this._turns[ turnIdx ].length  + throw_ );
        return this._turns[ turnIdx ][ throwIdx ];
    }

    this.addThrow = function( turn, throw_ )
    {
        var turnIdx = ( turn >= 0 ? turn : this._turns.length + turn );

        var i = ( this._turns[ turnIdx ].push( throw_ ) - 1 );

        if( this.onThrowAdded )
            this.onThrowAdded( this, turnIdx, i, throw_ );

        return i;
    }

    this.insertThrow = function( turn, throwIdx, throw_ )
    {
        var turnIdx = ( turn >= 0 ? turn : this._turns.length + turn );
        throwIdx = ( throwIdx >= 0 ? throwIdx : this._turns[ turnIdx ].length  + throwIdx + 1 );

        this._turns[ turnIdx ].splice( throwIdx, 0, throw_ );

        if( this.onThrowAdded )
            this.onThrowAdded( this, turnIdx, throwIdx, throw_ );

        return throwIdx;
    }

    this.removeThrow = function( turn, throwIdx )
    {
        var turnIdx = ( turn >= 0 ? turn : this._turns.length + turn );
        throwIdx = ( throwIdx >= 0 ? throwIdx : this._turns[ turnIdx ].length  + throwIdx );

        var throw_ = this._turns[ turnIdx ][ throwIdx ];

        var i = this._turns[ turnIdx ].splice( throwIdx, 1 ).length;

        if( i === 1 && this.onThrowRemoved )
            this.onThrowRemoved( this, turnIdx, throwIdx, throw_ )

        return i;
    }

    this.getScore = function()
    {
        return this._score;
    }

    this.setScore = function( score )
    {
        this._score = score;

        if( this.onScoreChanged )
            this.onScoreChanged( this );
    }

    this.getPlacement = function( place )
    {
        return this._placement;
    }

    this.setPlacement = function( place )
    {
        this._placement = place;
    }
}

function Game()
{
    this.onStarted              = null;
    this.onPlayerAdded          = null;
    this.onPlayerRemoved        = null;
    this.onCurrentPlayerChanged = null;
    this.onFinished             = null;

    this._ruleset          = null;
    this._playerRecords    = [];
    this._playerOrder      = [];
    this._maxHistoryLength = 20;

    this._state           = Game.State.Setup;
    this._currentPlayer   = 0;
    this._placements      = [];
    this._history         = null;
    this._historyIterator = null;
    this._historyPosition = 0;

    this.restart = function()
    {
        if( this._playerRecords.length === 0 )
            return;

        this.clearHistory();

        for( var i = 0; i < this._playerRecords.length; ++i )
            this._playerRecords[ i ].reset();

        if( this._placements.length === this._playerRecords.length )
            this._playerOrder = this._placements;

        this._currentPlayer = 0;
        this._placements    = [];

        this._ruleset.onStart();

        this._state = Game.State.Ongoing;

        if( this.onStarted )
            this.onStarted( this );
        if( this.onCurrentPlayerChanged )
            this.onCurrentPlayerChanged( this );
    }

    this.setRuleset = function( ruleset )
    {
        this._ruleset = ruleset;
    }

    this.getState = function()
    {
        return this._state;
    }

    this.setState = function( state )
    {
        this._state = state;
    }

    this.getNumPlayers = function()
    {
        return this._playerRecords.length;
    }

    this.getPlayer = function( index )
    {
        return this._playerRecords[ index ].getPlayerName();
    }

    this.getPlayerRecords = function( index )
    {
        return this._playerRecords[ index ];
    }

    this.getPlayerRecordsByOrder = function( orderedIndex )
    {
        return this._playerRecords[ this._playerOrder[ orderedIndex ] ];
    }

    this.addPlayer = function( name, index, order, skipHistoryEntry )
    {
        var record = new PlayerRecords( name );

        if( index )
            this._playerRecords.splice( index, 0, record );
        else
            index = ( this._playerRecords.push( record ) - 1 );

        if( order )
            this._playerOrder.splice( order, 0, index );
        else
            order = ( this._playerOrder.push( index ) - 1 );

        if( !skipHistoryEntry )
        {
            this.pushHistoryEntry( {
                                      undo: function( game ) { game.removePlayer( index ) },
                                      redo: function( game ) { game.addPlayer( name, index, order, true ) }
                                   } );
        }

        if( this.onPlayerAdded )
            this.onPlayerAdded( this, name, index );

        if( this._state === Game.State.Ongoing )
        {
            var maxScore = 0;
            for( var i = 0; i < this._playerRecords.length; ++i )
            {
                if( i !== index )
                {
                    var score = this._playerRecords[ i ].getScore();
                    if( score > maxScore )
                        maxScore = score;
                }
            }

            record.setScore( maxScore );
        }

        return index;
    }

    this.removePlayer = function( index )
    {
        if( index >= this._playerRecords.length )
        {
            log_error( "Invalid index (" + index + ") in Game.removePlayer()" );
            return;
        }

        var name = this._playerRecords[ index ].getPlayerName();

        var i = this._playerRecords.splice( index, 1 ).length;

        this._playerOrder.splice( this._playerRecords.indexOf( index ), 1 );

        if( i === 1 && this.onPlayerRemoved )
        {
            this.onPlayerRemoved( this, name, index );
        }
    }

    this.getCurrentPlayerIndex = function()
    {
        return this._playerOrder[ this._currentPlayer ];
    }

    this.getCurrentPlayerOrderIndex = function()
    {
        return this._currentPlayer;
    }

    this.setCurrentPlayerOrderIndex = function( orderedIndex )
    {
        this._currentPlayer = orderedIndex;

        if( this.onCurrentPlayerChanged )
            this.onCurrentPlayerChanged( this );
    }

    this.getCurrentPlayerRecords = function()
    {
        return this._playerRecords[ this._playerOrder[ this._currentPlayer ] ];
    }

    this.getPlacements = function()
    {
        return this._placements;
    }

    this.playerFinished = function( index )
    {
        var player = this.getPlayerRecords( index );

        if( player.getPlacement() >= 0 )
        {
            log_error( "Game.playerFinished() called for already finished player." );
            return;
        }

        var placemenet = ( this._placements.push( index ) - 1 );
        player.setPlacement( placemenet );

        if( this.onPlayerFinished )
            this.onPlayerFinished( this, player.getPlayerName(), placement )

        if( this._placements.length === this._playerRecords.length )
            this._finish();
    }

    this.playerFinishedByOrder = function( orderedIndex )
    {
        this.playerFinished( this._playerOrder[ orderedIndex ] );
    }

    this.getNextUnfinishedPlayerOrderIndex = function()
    {
        var numPlayers = this._playerRecords.length;

        if( numPlayers === 1 )
        {
            if( this._playerRecords[ 0 ].getPlacement() < 0 )
                return this._currentPlayer;
        }
        else
        {
            for( var i = 1; i < numPlayers; ++i )
            {
                var orderedIndex = ( ( this._currentPlayer + i ) % numPlayers );
                if( this._playerRecords[ this._playerOrder[ orderedIndex ] ].getPlacement() < 0 )
                    return orderedIndex;
            }
        }

        return -1;
    }

    this.sectionHit = function( section )
    {
        if( this._state === Game.State.Ongoing )
            this._ruleset.onSectionHit( section );
    }

    this.undo = function()
    {
        var entry = this._getUndoHistoryEntry();
        if( entry )
            entry.undo( this );
    }

    this.redo = function()
    {
        var entry = this._getRedoHistoryEntry();
        if( entry )
            entry.redo( this );
    }

    this.getHistoryLength = function()
    {
        return this._historyPosition;
    }

    this.pushHistoryEntry = function( item )
    {
        if( this._historyPosition >= this._maxHistoryLength )
        {
            this._history = this._history._next;
            this._history._prev._next = null;
            this._history._prev = null;
            --this._historyPosition;
        }

        if( this._historyIterator )
        {
            if( this._historyIterator._next )
                this._historyIterator._next._prev = null;

            this._historyIterator._next = item;
            item._prev = this._historyIterator;
            this._historyIterator = item;
        }
        else
        {
            this._history = item;
            this._history._prev = null;
            this._history._next = null;

            this._historyIterator = this._history;
        }

        ++this._historyPosition;
    }

    this.clearHistory = function()
    {
        this._history       = null;
        this._historyIterator   = null;
        this._historyPosition = 0;
    }

    this._getUndoHistoryEntry = function()
    {
        if( this._historyIterator )
        {
            var item = this._historyIterator;
            this._historyIterator = item._prev;
            --this._historyPosition;
            return item;
        }
        else
            return null;
    }

    this._getRedoHistoryEntry = function()
    {
        var item = null;
        if( this._historyIterator )
            item = this._historyIterator._next;
        else if( this._history )
            item = this._history;

        if( item )
        {
            this._historyIterator = item;
            ++this._historyPosition;
        }

        return item;
    }

    this._finish = function()
    {
        if( this._state === Game.State.Ongoing )
        {
            this._state = Game.State.Finished;

            this.clearHistory();

            if( this.onFinished )
                this.onFinished( this, this._placements );
        }
    }
}

Game.State = {
    Setup: 0,
    Ongoing: 1,
    Finished: 2
};
if( Object.freeze ) Object.freeze( Game.State );

// ------------------------------------------------------------------------------------------------

function DefaultRuleset( game, initialScore )
{
    function ThrowHistoryEntry( playerIndex, turn, throwIdx, throw_, nextPlayerIndex )
    {
        this.undo = function( game )
        {
            var player = game.getPlayerRecordsByOrder( playerIndex );

            if( throwIdx === 2 || throw_.busted )
                game.setCurrentPlayerOrderIndex( playerIndex );

            player.removeThrow( turn, throwIdx );

            if( throwIdx === 0 )
                player.removeTurn( turn );

            var newScore = player.getScore();
            if( throw_.busted )
            {
                for( var i = 0; i < throwIdx; ++i )
                    newScore -= player.getThrow( turn, i ).section.score;
            }
            else
                newScore += throw_.section.score;

            player.setScore( newScore );
        }

        this.redo = function( game )
        {
            var player = game.getPlayerRecordsByOrder( playerIndex );

            if( throwIdx === 0 )
                player.addTurn( turn );

            player.addThrow( turn, throw_ );

            var newScore = player.getScore();
            if( throw_.busted )
            {
                for( var i = 0; i < throwIdx; ++i )
                    newScore += player.getThrow( turn, i ).section.score;
            }
            else
                newScore -= throw_.section.score;

            player.setScore( newScore );

            if( throwIdx === 2 || throw_.busted )
                game.setCurrentPlayerOrderIndex( nextPlayerIndex );
        }
    }

    this.getName = function()
    {
        return "Default" + initialScore;
    }

    this.onStart = function()
    {
        var numPlayers = game.getNumPlayers();
        for( var i = 0; i < numPlayers; ++i )
            game.getPlayerRecords( i ).setScore( initialScore );
    }

    this.onSectionHit = function( section )
    {
        var currentPlayer = game.getCurrentPlayerRecords();
        var currentScore  = currentPlayer.getScore();

        if( currentPlayer.getNumTurns() === 0 )
            currentPlayer.addTurn();

        var throw_ = currentPlayer.getNumThrows( -1 );

        if( throw_ === 3 ||
            ( throw_ > 0 && currentPlayer.getThrow( -1, -1 ).busted ) )
        {
            currentPlayer.addTurn();
            throw_ = 0;
        }

        var busted = ( currentScore < section.score );
        currentPlayer.addThrow( -1, new Throw( section, busted ) );

        var newScore = currentScore;
        if( busted )
        {
            for( var i = 0; i < throw_; ++i )
                newScore += currentPlayer.getThrow( -1, i ).section.score;
        }
        else
            newScore -= section.score;

        currentPlayer.setScore( newScore );

        var nextPlayer = game.getNextUnfinishedPlayerOrderIndex();

        game.pushHistoryEntry( new ThrowHistoryEntry( game.getCurrentPlayerOrderIndex(),
                                                      currentPlayer.getNumTurns() - 1,
                                                      throw_,
                                                      currentPlayer.getThrow( -1, -1 ),
                                                      nextPlayer ) );

        if( newScore === 0 )
        {
            game.playerFinishedByOrder( game.getCurrentPlayerOrderIndex() );

            var numPlayers = game.getNumPlayers();
            if( numPlayers > 1 )
            {
                if( game.getPlacements().length < numPlayers - 1 )
                    game.setCurrentPlayerOrderIndex( nextPlayer );
                else
                    game.playerFinishedByOrder( nextPlayer );
            }
        }
        else if( throw_ === 2 || busted )
        {
            game.setCurrentPlayerOrderIndex( nextPlayer );
        }
    }
}

// ------------------------------------------------------------------------------------------------

function UI( game, container )
{
    function PlayerUI( player, playerIndex, container )
    {
        this._root          = null;
        this._scoreHeader   = null;
        this._nameHeader    = null;
        this._scoreColumn   = null;
        this._highlighted   = false;
        this._throwElements = [];

        this._init = function()
        {
            this._root = document.createElement( "div" );
            this._root.className = "player-column";

            this._scoreHeader = document.createElement( "h1" );
            this._scoreHeader.className = "score-header";
            this._scoreHeader.innerHTML = player.getScore();
            this._root.appendChild( this._scoreHeader );

            this._scoreHeader.ondblclick = function( event )
            {
                event.preventDefault();
                event.stopPropagation();

                if( game.getState() === Game.State.Ongoing )
                {
                    var score = parseInt( prompt( "Set score to" ) );
                    if( !isNaN( score ) )
                        player.setScore( score );
                }
            };

            this._nameHeader = document.createElement( "h2" );
            this._nameHeader.className = "name-header";
            this._nameHeader.innerHTML = player.getPlayerName();
            this._root.appendChild( this._nameHeader );

            this._scoreColumn = document.createElement( "div" );
            this._scoreColumn.className = "score-column";
            this._root.appendChild( this._scoreColumn );

            container.appendChild( this._root );
        }
        this._init();

        this.clearThrows = function()
        {
            this._throwElements = [];
            this._scoreColumn.innerHTML = "";
        }

        this.setHighlight = function( highlight )
        {
            this._root.className = ( highlight ? "player-column active" : "player-column" );
        }

        this.remove = function()
        {
            this._root.parentElement.removeChild( this._root );
        }

        player.onThrowAdded = ( function( player, turn, throwIdx, throw_ )
        {
            var el = document.createElement( "div" );
            el.innerHTML = throw_.section.toString();
            if( throw_.busted )
                el.className = "busted";

            if( turn === this._throwElements.length )
                this._throwElements.push( [] );

            if( throwIdx >= this._throwElements[ turn ].length )
            {
                this._throwElements[ turn ].push( el );
                this._scoreColumn.appendChild( el );
            }
            else
            {
                this._throwElements[ turn ].splice( throwIdx, 0, el );
                this._scoreColumn.insertBefore( el, this._throwElements[ turn ][ throwIdx ] );
            }
        } ).bind( this );

        player.onThrowRemoved = ( function( player, turn, throwIdx, throw_ )
        {
            var el = this._throwElements[ turn ][ throwIdx ];
            el.parentElement.removeChild( el );

            this._throwElements[ turn ].splice( throwIdx, 1 );
        } ).bind( this );

        player.onScoreChanged = ( function( player )
        {
            this._scoreHeader.innerHTML = player.getScore();
        } ).bind( this );
    }

    this._players = [];
    this._activePlayer = null;

    this.addPlayer = function()
    {
        var name = prompt("Name");
        if( name === null )
            return;
        else if( name === "" )
            name = "Player " + ( game.getNumPlayers() + 1 );

        game.addPlayer( name );
    }

    game.onStarted = ( function( game )
    {
        for( var i = 0; i < this._players.length; ++i )
            this._players[ i ].clearThrows();
    } ).bind( this );

    game.onPlayerAdded = ( function( game, name, index )
    {
        this._players[ index ] = new PlayerUI( game.getPlayerRecords( index ), index, container );
    } ).bind( this );

    game.onPlayerRemoved = ( function( game, name, index )
    {
        this._players[ index ].remove();
        this._players.splice( index, 1 );
    } ).bind( this );

    game.onCurrentPlayerChanged = ( function( game )
    {
        if( this._activePlayer )
        {
            this._activePlayer.setHighlight( false );
            this._activePlayer = null;
        }

        this._activePlayer = this._players[ game.getCurrentPlayerIndex() ];
        this._activePlayer.setHighlight( true );
    } ).bind( this );

    game.onFinished = ( function( game, placements )
    {
        var msg = "";
        for( var i = 0; i < placements.length; ++i )
            msg += ( i + 1 ) + ". " + game.getPlayerRecords( placements[ i ] ).getPlayerName() + "\n";
        alert( msg );
    } ).bind( this );
}

// ------------------------------------------------------------------------------------------------

var game = null;
var ui   = null;

function onLoad()
{
    game = new Game();
    game.setRuleset( new DefaultRuleset( game, 301 ) );

    ui = new UI( game, document.getElementById( "score-table" ) );

    addClickHandlers();
}

function onSectionClicked( event )
{
    event.preventDefault();
    event.stopPropagation();

    game.sectionHit( this.section );
}

function initSectionElement( id, type, baseScore )
{
    field = document.getElementById( id );
    field.section     = new Section( type, baseScore );
    field.onmousedown = onSectionClicked;

    field.style.stroke      = "";
    field.style.strokeWidth = "";
    field.setAttribute( "class", "score-field" );
}

function addClickHandlers()
{
    for( var i = 1; i <= 20; ++i )
    {
        initSectionElement( "double" + i, Section.Type.Double, i );
        initSectionElement( "outer"  + i, Section.Type.Outer , i );
        initSectionElement( "triple" + i, Section.Type.Triple, i );
        initSectionElement( "inner"  + i, Section.Type.Inner , i );
    }

    initSectionElement( "outerBullseye", Section.Type.OuterBullseye, 25 );
    initSectionElement( "innerBullseye", Section.Type.InnerBullseye, 50 );

    var miss = document.getElementById( "svg-container" );
    miss.section = new Section( Section.Type.Miss, 0 );
    miss.onmousedown = onSectionClicked;
}

