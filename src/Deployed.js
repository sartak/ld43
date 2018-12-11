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
          <GameMetadata />
        </div>
      </div>
    );
  }
}

class GameMetadata extends Component<{}> {
  render() {
    return (
      <div className="game-metadata">
        <h1>Pigheaded Pirate</h1>
        <h2>a tale of lust and love</h2>
        <h3>
          by
          <br />
          <a href="https://sartak.org">@sartak</a>
          <br />
          <a href="https://twitter.com/sartak">
            <img src={twitterLogo} alt="@sartak on Twitter" />
          </a>
          <a href="https://twitch.tv/sartak">
            <img src={twitchLogo} alt="sartak on Twitch" />
          </a>
        </h3>
        <p>
          created solo in 48 hours as part of
          <br />
          the <strong>Ludum Dare 43</strong> compo
        </p>
        <p>
          <a href="https://ldjam.com/events/ludum-dare/43/pigheaded-pirate">
            ldjam.com/events/ludum-dare/43/pigheaded-pirate
          </a>
        </p>
        <p>
          for the theme
          <br />
          <em>"Sacrifices must be made"</em>
        </p>
        <p>
          timelapse at
          <br />
          <a className="url" href="https://www.youtube.com/watch?v=8nS62CichfU">
            youtube.com/watch?v=8nS62CichfU
          </a>
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
