# pages/1_📊_Dashboard_de_Diagnóstico.py
import streamlit as st
import pandas as pd
import plotly.express as px

st.set_page_config(page_title="Dashboard - ULTRADATA", layout="wide")
st.title("📊 Dashboard de Diagnóstico da Base")

# 1. Carregar os dados (substitua pela sua lógica de carregamento)
# Supondo que 'df' seja seu DataFrame principal carregado
if 'df' not in st.session_state or st.session_state.df.empty:
    st.warning("⚠️ Nenhum dado carregado. Vá para a página 'Upload' primeiro.")
    st.stop()

df = st.session_state.df

st.subheader("Visão Geral da Base")
col1, col2, col3 = st.columns(3)
col1.metric("Total de Itens", len(df))
col2.metric("Colunas", len(df.columns))
# Conte valores únicos em colunas-chave
sku_unicos = df['sku'].nunique() if 'sku' in df.columns else 0
col3.metric("SKUs Únicos", sku_unicos, delta=f"{len(df)-sku_unicos} possíveis dups")

# 2. Análise de Categorias (Sua Dúvida Principal)
st.subheader("🔍 Análise de Categorias")
if 'categoria' in df.columns:
    contagem_categorias = df['categoria'].value_counts().reset_index()
    contagem_categorias.columns = ['Categoria', 'Quantidade de Itens']
    
    # Gráfico de barras
    fig = px.bar(contagem_categorias.head(20), 
                 x='Categoria', y='Quantidade de Itens',
                 title='Top 20 Categorias (Mais Frequentes)')
    st.plotly_chart(fig, use_container_width=True)
    
    # Tabela interativa com exemplos
    st.write("**Tabela Detalhada (Clique para expandir exemplos):**")
    for idx, row in contagem_categorias.head(15).iterrows():
        with st.expander(f"{row['Categoria']} — {row['Quantidade de Itens']} itens"):
            exemplos = df[df['categoria'] == row['Categoria']][['sku', 'nome']].head(5)
            st.table(exemplos)
else:
    st.info("A coluna 'categoria' não foi encontrada nos dados.")

# 3. Análise de Duplicidades por SKU
st.subheader("🔎 Duplicidades por SKU")
if 'sku' in df.columns:
    duplicados_sku = df[df.duplicated(subset=['sku'], keep=False)]
    if not duplicados_sku.empty:
        st.warning(f"Encontrados {len(duplicados_sku)} itens com SKU potencialmente duplicado.")
        st.dataframe(duplicados_sku[['sku', 'nome', 'categoria']].head(20))
        
        # Botão para exportar duplicidades
        csv = duplicados_sku.to_csv(index=False).encode('utf-8')
        st.download_button("📥 Exportar Duplicidades para CSV", 
                          csv, 
                          "duplicidades_sku.csv",
                          "text/csv")
    else:
        st.success("✅ Nenhuma duplicidade por SKU encontrada.")
