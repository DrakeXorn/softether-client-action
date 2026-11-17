# SoftEther VPN Client Action

[![CI](https://github.com/drakexorn/softether-client-action/actions/workflows/ci.yml/badge.svg)](https://github.com/drakexorn/softether-client-action/actions/workflows/ci.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

Connects a GitHub Actions runner to a [SoftEther VPN](https://www.softether.org/) server for
the rest of the job. A post step disconnects and cleans up automatically.

> [Note]
> At the moment, this action works with Linux-based runners **only**. The runner needs `sudo` (or root) and `apt` to
> install the SoftEther client if it isn't already present.

## Usage

### Password

```yaml
steps:
  - uses: drakexorn/softether-client-action@v1
    with:
      server: vpn.example.com
      port: 443
      hub: DEFAULT
      username: ${{ secrets.VPN_USERNAME }}
      password: ${{ secrets.VPN_PASSWORD }}
      server_ca: ${{ secrets.VPN_SERVER_CA }} # optional, enables server verification

  - run: curl http://10.0.0.10/internal-api # reachable through the VPN
```

### Client certificate

```yaml
- uses: drakexorn/softether-client-action@v1
  with:
    server: vpn.example.com
    port: 443
    authentication_method: certificate
    username: ci-bot
    client_cert: ${{ secrets.VPN_CLIENT_CERT }}
    client_key: ${{ secrets.VPN_CLIENT_KEY }}
```

## Inputs

| Name                    | Default    | Description                                                                                                                                |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `server`                | (required) | Host name or IP of the VPN server.                                                                                                         |
| `port`                  | `443`      | Server port.                                                                                                                               |
| `hub`                   | `DEFAULT`  | Virtual Hub name.                                                                                                                          |
| `authentication_method` | `password` | `password`, `radius`, `certificate` or `anonymous`.                                                                                        |
| `username`              |            | Required for every method except `anonymous`.                                                                                              |
| `password`              |            | For `password` / `radius`.                                                                                                                 |
| `client_cert`           |            | PEM certificate, for `certificate`.                                                                                                        |
| `client_key`            |            | PEM private key, for `certificate`.                                                                                                        |
| `server_ca`             |            | PEM CA that signed the server certificate. When empty, the server is **not verified**.                                                     |
| `send_all_traffic`      | `false`    | When `true`, all runner traffic uses the VPN (the server must provide a default gateway via DHCP). When `false`, only the VPN subnet does. |
| `timeout`               | `30`       | Seconds to wait for the session to be established.                                                                                         |

Pass credentials through [encrypted secrets](https://docs.github.com/actions/security-guides/using-secrets-in-github-actions). The action masks `password` and `client_key` in logs.

## Outputs

| Name        | Description                                     |
| ----------- | ----------------------------------------------- |
| `interface` | VPN network interface (`vpn_vpn`).              |
| `ip`        | IPv4 address assigned to the runner on the VPN. |

## How it works

1. Installs `softether-vpnclient` and `isc-dhcp-client` with `apt` if they're missing, then starts the client service.
2. Configures a connection with `vpncmd /CLIENT`: a virtual NIC, an account, the credentials, and server verification.
   Then it connects and waits for `Session Established`.
3. Pins a route to the VPN server through the current gateway, then gets an address for `vpn_vpn` with `dhclient`.
4. Post step: releases the DHCP lease, disconnects, deletes the account and the NIC, and removes the pinned route and
   temp files.

## Development

```sh
yarn install
yarn test       # Jest (TypeScript through @swc/jest)
yarn typecheck  # tsc
yarn bundle     # format and build dist/index.js (commit it)
```
