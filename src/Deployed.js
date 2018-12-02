// @flow
import React, { Component } from 'react';
import Engine from './Engine';
import twitchLogo from './assets/public/twitchLogo.png';
import twitterLogo from './assets/public/twitterLogo.png';

export default class Deployed extends Component<{}> {
  render() {
    return (
      <div className="deployed">
        <Engine />
        <div className="game-info">
          <GameControls />
          <GameMetadata />
        </div>
      </div>
    );
  }
}

class GameControls extends Component<{}> {
  render() {
    return (
      <div className="game-controls">
        <p>
          controls:
          <ul>
            <li>z: pickup, throw</li>
            <li>↑: jump</li>
            <li>←: left</li>
            <li>→: right</li>
          </ul>
        </p>
      </div>
    );
  }
}

class GameMetadata extends Component<{}> {
  render() {
    return (
      <div className="game-metadata">
        <p>Pigheaded Pirate</p>
        <p>
          created by
          <br />
          <a href="https://sartak.org">@sartak</a>
          <a href="https://twitter.com/sartak">
            <img src={twitterLogo} alt="@sartak on Twitter" />
          </a>
          <a href="https://twitch.tv/sartak">
            <img src={twitchLogo} alt="sartak on Twitch" />
          </a>
        </p>
        <p>
          for
          <br />
          <a href="https://ldjam.com/events/ludum-dare/43/">
            Ludum Dare 43
          </a>
          <br />
          <em>"Sacrifices must be made"</em>
        </p>
        <p>
          code at
          <br />
          <a className="url" href="https://github.com/sartak/pigheaded-pirate">
            github.com/sartak/pigheaded-pirate
          </a>
        </p>
      </div>
    );
  }
}
