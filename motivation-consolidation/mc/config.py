"""Конфіг: відповідність назв дистриб'юторів і пороги перевірок."""

from __future__ import annotations

import os
from dataclasses import dataclass, field

import yaml

DEFAULT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                            "config", "distributors.yaml")


@dataclass
class DistributorRule:
    consolidated: str
    match: list[str]
    promo: bool = True


@dataclass
class Settings:
    tolerance: float = 0.51
    performance_min: float = 0.30
    performance_max: float = 2.00
    cost_deviation: float = 2.0
    tier_tolerance: float = 0.01


@dataclass
class Config:
    settings: Settings = field(default_factory=Settings)
    distributors: list[DistributorRule] = field(default_factory=list)

    def resolve(self, raw_name: str) -> DistributorRule | None:
        """Знаходить рядок зведеної за назвою з файлу-джерела.

        Виграє найдовший збіг: «Буковина Трек ІФ» містить у собі
        «Буковина Трек», і без цього правила два дистриб'ютори
        злилися б в одного.
        """
        low = (raw_name or "").lower()
        best = None
        best_len = 0
        for rule in self.distributors:
            for frag in rule.match:
                if frag.lower() in low and len(frag) > best_len:
                    best, best_len = rule, len(frag)
        return best


def load(path: str | None = None) -> Config:
    with open(path or DEFAULT_PATH, encoding="utf-8") as fh:
        raw = yaml.safe_load(fh) or {}
    settings = Settings(**(raw.get("settings") or {}))
    rules = [DistributorRule(**d) for d in (raw.get("distributors") or [])]
    return Config(settings=settings, distributors=rules)
