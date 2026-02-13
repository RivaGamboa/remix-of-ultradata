# core/processador.py
import pandas as pd
import numpy as np

class ProcessadorULTRADATA:
    @staticmethod
    def encontrar_duplicidades(df, colunas=['sku', 'nome'], metodo='sku'):
        """
        Encontra duplicidades na base.
        método: 'sku' (exato), 'nome' (similaridade), 'combinado'
        """
        duplicados = pd.DataFrame()
        
        if metodo == 'sku' and 'sku' in df.columns:
            duplicados = df[df.duplicated(subset=['sku'], keep=False)]
        
        return duplicados
    
    @staticmethod
    def analisar_coluna(df, nome_coluna):
        """Retorna estatísticas de uma coluna específica."""
        if nome_coluna not in df.columns:
            return None
        
        valores = df[nome_coluna].dropna()
        analise = {
            'total': len(df),
            'preenchidos': len(valores),
            'vazios': df[nome_coluna].isna().sum(),
            'taxa_preenchimento': f"{(len(valores)/len(df)*100):.1f}%",
            'valores_unicos': valores.nunique(),
            'exemplos': valores.head(5).tolist() if not valores.empty else []
        }
        return analise
