{
  description = "A language server (LSP) for the Coq theorem prover";

  outputs = inputs @ {
    self,
    flake-parts,
    treefmt,
    ...
  }:
    flake-parts.lib.mkFlake {inherit inputs;} {
      systems = ["x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin"];
      imports = [treefmt.flakeModule ./editor/code/flakeModule.nix];

      perSystem = {
        config,
        pkgs,
        lib,
        ...
      }: let
        l = lib // builtins;

        coqVersion = "8.18+alpha";
        ocamlPackages = pkgs.ocamlPackages;

        mkDunePackageFromInput = input: args:
          ocamlPackages.buildDunePackage (args
            // {
              duneVersion = "3";
              version = "${input.lastModifiedDate}+${coqVersion}";
              src = input.outPath;
            });

        coq-core = mkDunePackageFromInput inputs.coq {
          pname = "coq-core";
          enableParallelBuilding = true;

          preConfigure = ''
            patchShebangs dev/tools/
          '';

          prefixKey = "-prefix ";
          propagatedBuildInputs = with ocamlPackages; [zarith findlib];
        };

        coq-serapi = mkDunePackageFromInput inputs.coq-serapi {
          pname = "coq-serapi";

          propagatedBuildInputs = l.attrValues {
            inherit coq-core;
            inherit (ocamlPackages) cmdliner findlib sexplib ppx_import ppx_deriving ppx_sexp_conv ppx_compare ppx_hash yojson ppx_deriving_yojson;
          };
        };
      in {
        packages.default = config.packages.coq-lsp;
        packages.coq-lsp = mkDunePackageFromInput self {
          pname = "coq-lsp";

          nativeBuildInputs = l.attrValues {
            inherit (ocamlPackages) menhir;
          };

          propagatedBuildInputs = l.attrValues {
            inherit coq-core coq-serapi;
            inherit (ocamlPackages) yojson cmdliner uri dune-build-info ocaml findlib;
          };
        };

        treefmt.config = {
          projectRootFile = "dune-project";

          flakeFormatter = true;

          settings.global.excludes = ["./vendor/**"];

          programs.alejandra.enable = true;
          programs.ocamlformat = {
            enable = true;
            configFile = ./.ocamlformat;
          };
        };

        devShells.default = pkgs.mkShell {
          inputsFrom = [config.packages.coq-lsp];

          packages = l.attrValues {
            inherit (config.treefmt.build) wrapper;
            inherit (pkgs) dune_3 nodejs;
            inherit (ocamlPackages) ocaml-lsp;
          };
        };
      };
    };

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    treefmt.url = "github:numtide/treefmt-nix";

    napalm.url = "github:nix-community/napalm";

    flake-compat = {
      url = "github:edolstra/flake-compat";
      flake = false;
    };

    coq = {
      url = "github:ejgallego/coq";
      flake = false;
    };

    coq-serapi = {
      url = "github:ejgallego/coq-serapi";
      flake = false;
    };
  };
}
